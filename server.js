/* ============================================================
   어디쯤 — 실시간 위치/ETA 공유 서버 (프로토타입)
   - 정적 파일 서빙(index.html 등)
   - REST: 모임 생성/조회
   - WebSocket: 모임별 실시간 위치 릴레이 + 도착 판정 + ETA
   실행: npm start   (기본 http://localhost:8000)
   ============================================================ */
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8000;
const ARRIVE_RADIUS_M = 80;   // 이 반경(m) 안에 들어오면 '도착'
const SPEED_KMH = 22;         // ETA 추정 속도(거리기반 폴백)
const JOIN_FAIL_MAX = 20;         // 윈도 동안 허용되는 join 실패 횟수
const JOIN_FAIL_WINDOW_MS = 60000; // join 실패 슬라이딩 윈도(ms)
// 선택: 카카오 길찾기(실제 경로 ETA)를 쓰려면 REST 키를 넣으세요. 비우면 거리기반 추정치 사용.
const KAKAO_REST_KEY = process.env.KAKAO_REST_KEY || '';
// 모임 정의 영속화 파일 (참여자/연결은 휘발성이라 저장하지 않음)
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

/** meetings: id -> {id,name,place,date,time,dest:{lat,lng,label}|null, room:Set<ws>} */
const meetings = new Map();
const genId = () => Math.random().toString(36).slice(2, 8);
const genSecret = () => crypto.randomBytes(24).toString('base64url');

// 상수시간 비교: 길이가 다르면 timingSafeEqual이 throw하므로 길이 확인을 먼저 한다.
function secretMatches(given, expected) {
  if (typeof given !== 'string' || !given) return false;
  if (typeof expected !== 'string' || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.byteLength !== b.byteLength) return false;
  return crypto.timingSafeEqual(a, b);
}

function loadMeetings() {
  try {
    const arr = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    let backfilled = 0;
    arr.forEach(m => {
      if (typeof m.secret !== 'string' || !m.secret) { m.secret = genSecret(); backfilled++; }
      meetings.set(m.id, { ...m, room: new Set() });
    });
    console.log(`[data] ${meetings.size}개 모임 로드`);
    if (backfilled > 0) {
      console.log(`[data] secret 없는 모임 ${backfilled}건에 새 secret 발급(backfill)`);
      saveMeetings();
    }
  } catch { /* 파일 없으면 새로 시작 */ }
}
function saveMeetings() {
  const arr = [...meetings.values()].map(({ id, name, place, date, time, dest, secret }) => ({ id, name, place, date, time, dest, secret }));
  fs.writeFile(DATA_FILE, JSON.stringify(arr), err => { if (err) console.error('[data] 저장 실패', err); });
}
loadMeetings();

app.post('/api/meetings', (req, res) => {
  const { name, place, date, time, dest } = req.body || {};
  const id = genId();
  const secret = genSecret();
  meetings.set(id, {
    id, name: name || '모임', place: place || '', date: date || '', time: time || '',
    dest: dest && dest.lat != null ? dest : null, secret, room: new Set(),
  });
  saveMeetings();
  console.log(`[meeting] created ${id} · ${name} · ${place}`);
  res.json({ id, secret });
});

app.get('/api/meetings/:id', (req, res) => {
  const m = meetings.get(req.params.id);
  if (!m) return res.status(404).json({ error: 'not found' });
  const { id, name, place, date, time, dest } = m;
  res.json({ id, name, place, date, time, dest, count: m.room.size });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// IP 단위 join 실패 슬라이딩 윈도: key(IP) -> { count, firstAt }
const joinFails = new Map();

function clientIpOf(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket.remoteAddress;
}

function isJoinBlocked(ip) {
  const rec = joinFails.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.firstAt > JOIN_FAIL_WINDOW_MS) { joinFails.delete(ip); return false; }
  return rec.count >= JOIN_FAIL_MAX;
}

function recordJoinFail(ip) {
  const rec = joinFails.get(ip);
  if (!rec || Date.now() - rec.firstAt > JOIN_FAIL_WINDOW_MS) {
    joinFails.set(ip, { count: 1, firstAt: Date.now() });
  } else {
    rec.count++;
  }
}

// 만료된 카운터를 주기적으로 정리 (맵이 무한히 커지지 않도록). 프로세스 종료를 막지 않는다.
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of joinFails) {
    if (now - rec.firstAt > JOIN_FAIL_WINDOW_MS) joinFails.delete(ip);
  }
}, JOIN_FAIL_WINDOW_MS).unref();

function haversineM(a, b) {
  const R = 6371000, toR = x => x * Math.PI / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function updateParticipant(m, p) {
  if (!m.dest || p.lat == null) return;
  p.distM = haversineM({ lat: p.lat, lng: p.lng }, m.dest);
  if (p.distM <= ARRIVE_RADIUS_M) { p.state = 'arrived'; p.eta = 0; return; }
  if (p.state !== 'arrived') p.state = 'coming';
  p.eta = Math.max(1, Math.round((p.distM / 1000) / SPEED_KMH * 60)); // 거리기반 폴백
  refineEta(m, p); // REST 키가 있으면 실제 경로 ETA로 비동기 보정
}

// 카카오모빌리티 자동차 길찾기로 실제 소요시간(초) → 분. 12초당 1회로 스로틀.
function refineEta(m, p) {
  if (!KAKAO_REST_KEY) return;
  if (Date.now() - (p._etaAt || 0) < 12000) return;
  p._etaAt = Date.now();
  const url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${p.lng},${p.lat}&destination=${m.dest.lng},${m.dest.lat}`;
  fetch(url, { headers: { Authorization: 'KakaoAK ' + KAKAO_REST_KEY } })
    .then(r => r.json())
    .then(j => {
      const sec = j?.routes?.[0]?.summary?.duration;
      if (sec) { p.eta = Math.max(1, Math.round(sec / 60)); broadcast(m); }
    })
    .catch(() => { /* 폴백(거리기반) 유지 */ });
}

function broadcast(m) {
  const participants = [...m.room].map(w => w.p).filter(Boolean).map(p => ({
    id: p.id, nick: p.nick, lat: p.lat, lng: p.lng, state: p.state, distM: p.distM, eta: p.eta,
  }));
  const payload = JSON.stringify({ t: 'state', dest: m.dest, participants });
  for (const w of m.room) if (w.readyState === 1) w.send(payload);
}

wss.on('connection', (ws, req) => {
  ws.meetingId = null; ws.p = null;
  ws.clientIp = clientIpOf(req);
  ws.on('message', raw => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }

    if (msg.t === 'join') {
      if (isJoinBlocked(ws.clientIp)) { ws.send(JSON.stringify({ t: 'error', msg: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요' })); return; }
      const m = meetings.get(msg.meetingId);
      if (!m) { recordJoinFail(ws.clientIp); ws.send(JSON.stringify({ t: 'error', msg: '모임을 찾을 수 없어요' })); return; }
      if (!secretMatches(msg.secret, m.secret)) { recordJoinFail(ws.clientIp); ws.send(JSON.stringify({ t: 'error', msg: '초대 링크가 올바르지 않아요' })); return; }
      joinFails.delete(ws.clientIp);
      ws.meetingId = m.id;
      ws.p = { id: genId(), nick: msg.nick || '익명', lat: null, lng: null, state: 'idle', distM: null, eta: null };
      m.room.add(ws);
      ws.send(JSON.stringify({ t: 'joined', id: ws.p.id, dest: m.dest }));
      console.log(`[join] ${ws.p.nick} → ${m.id} (총 ${m.room.size}명)`);
      broadcast(m);

    } else if (msg.t === 'loc') {
      const m = meetings.get(ws.meetingId); if (!m || !ws.p) return;
      ws.p.lat = msg.lat; ws.p.lng = msg.lng;
      if (ws.p.state === 'idle') ws.p.state = 'coming';
      updateParticipant(m, ws.p);
      broadcast(m);

    } else if (msg.t === 'stop') {
      const m = meetings.get(ws.meetingId);
      if (ws.p) { ws.p.state = 'idle'; ws.p.lat = null; ws.p.lng = null; ws.p.distM = null; ws.p.eta = null; }
      if (m) broadcast(m);
    }
  });

  ws.on('close', () => {
    const m = meetings.get(ws.meetingId);
    if (m) { m.room.delete(ws); broadcast(m); console.log(`[leave] ${ws.p?.nick} (남은 ${m.room.size}명)`); }
  });
});

server.listen(PORT, () => {
  console.log(`\n어디쯤 서버 실행 중 → http://localhost:${PORT}`);
  console.log(`실제 경로 ETA(카카오 길찾기): ${KAKAO_REST_KEY ? '사용' : '미사용(거리기반 추정)'}\n`);
});
