#!/usr/bin/env node
/* ============================================================
   verify-join-secret.mjs
   실제 서버 프로세스를 띄워 초대 링크 secret 검증(join 게이팅) 동작을 확인하는
   회귀 검증 스크립트. 의존성 추가 없이 기존 `ws` 클라이언트와 Node 빌트인만 사용한다.

   실행: node scripts/verify-join-secret.mjs
   Rate limit(H) 포함 실행: CHECK_RATE_LIMIT=1 node scripts/verify-join-secret.mjs
   ============================================================ */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const PORT = 8300 + Math.floor(Math.random() * 400);
const DATA_FILE = path.join(os.tmpdir(), `wj-verify-${PORT}.json`);
const BASE_URL = `http://localhost:${PORT}`;
const WS_URL = `ws://localhost:${PORT}/ws`;

let child = null;
let cleanedUp = false;

function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  if (child && !child.killed) {
    try { child.kill(); } catch { /* ignore */ }
  }
  try { fs.unlinkSync(DATA_FILE); } catch { /* ignore - may not exist */ }
}

process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('SIGTERM', () => { cleanup(); process.exit(1); });

function fail(label, expected, actual) {
  console.error(`FAIL: ${label}`);
  console.error(`  expected: ${expected}`);
  console.error(`  actual:   ${actual}`);
  cleanup();
  process.exit(1);
}

async function check(label, fn) {
  try {
    await fn();
    console.log(`PASS: ${label}`);
  } catch (e) {
    if (e && e.__checkFailure) {
      fail(label, e.expected, e.actual);
    } else {
      fail(label, '(no error)', (e && e.stack) || String(e));
    }
  }
}

function assertEqual(expected, actual, msg) {
  if (expected !== actual) {
    const err = new Error(msg || 'assertion failed');
    err.__checkFailure = true;
    err.expected = expected;
    err.actual = actual;
    throw err;
  }
}

function assertTrue(cond, expectedDesc, actualDesc) {
  if (!cond) {
    const err = new Error('assertion failed');
    err.__checkFailure = true;
    err.expected = expectedDesc;
    err.actual = actualDesc;
    throw err;
  }
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function waitForServerReady() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/meetings/__none__`);
      if (res.status === 404) return true;
    } catch { /* not up yet */ }
    await sleep(100);
  }
  console.error('서버가 기동하지 않았습니다. 자식 프로세스 출력:');
  if (child && child.__stdout) console.error('--- stdout ---\n' + child.__stdout);
  if (child && child.__stderr) console.error('--- stderr ---\n' + child.__stderr);
  cleanup();
  process.exit(1);
}

/** WS join 헬퍼: /ws 접속 후 join 메시지 전송, 첫 응답 메시지 1건을 파싱해 반환 (1500ms 타임아웃) */
function joinOnce({ meetingId, secret, nick }) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch { /* ignore */ }
      reject(new Error('joinOnce timeout (1500ms)'));
    }, 1500);

    ws.on('open', () => {
      const payload = { t: 'join', meetingId, nick: nick || 'tester' };
      if (secret !== undefined) payload.secret = secret;
      ws.send(JSON.stringify(payload));
    });
    ws.on('message', raw => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      let msg;
      try { msg = JSON.parse(raw); } catch { msg = null; }
      resolve({ msg, ws });
    });
    ws.on('error', err => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

/** 이미 join된 소켓에 loc을 보낸 뒤, waitMs 동안 t==='state' 메시지가 오는지 확인 */
function sendLocAndWaitForState(ws, loc, waitMs) {
  return new Promise(resolve => {
    let gotState = false;
    const onMessage = raw => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      if (msg.t === 'state') gotState = true;
    };
    ws.on('message', onMessage);
    ws.send(JSON.stringify({ t: 'loc', ...loc }));
    setTimeout(() => {
      ws.removeListener('message', onMessage);
      resolve(gotState);
    }, waitMs);
  });
}

async function main() {
  child = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DATA_FILE },
    stdio: 'pipe',
  });
  child.__stdout = '';
  child.__stderr = '';
  child.stdout.on('data', d => { child.__stdout += d.toString(); });
  child.stderr.on('data', d => { child.__stderr += d.toString(); });

  await waitForServerReady();

  let createdId = null;
  let createdSecret = null;

  // A. POST /api/meetings 응답에 id와 20자 이상 url-safe secret
  await check('A. POST /api/meetings returns id + url-safe secret (>=20 chars)', async () => {
    const res = await fetch(`${BASE_URL}/api/meetings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '검증모임', place: '강남역', date: '', time: '', dest: null }),
    });
    const json = await res.json();
    assertTrue(typeof json.id === 'string' && json.id.length > 0, 'string id', JSON.stringify(json));
    assertTrue(typeof json.secret === 'string', 'string secret', JSON.stringify(json));
    assertTrue(/^[A-Za-z0-9_-]{20,}$/.test(json.secret), 'secret matches /^[A-Za-z0-9_-]{20,}$/', json.secret);
    createdId = json.id;
    createdSecret = json.secret;
  });

  // B. GET /api/meetings/:id 응답에 secret 미노출
  await check('B. GET /api/meetings/:id does not expose secret', async () => {
    const res = await fetch(`${BASE_URL}/api/meetings/${createdId}`);
    assertEqual(200, res.status, 'GET status 200');
    const text = await res.text();
    assertTrue(!text.includes(createdSecret), 'response text does not contain secret substring', text);
    const json = JSON.parse(text);
    assertTrue(!Object.prototype.hasOwnProperty.call(json, 'secret'), 'no secret key', JSON.stringify(json));
  });

  // C. 올바른 secret으로 join -> joined
  let goodWs = null;
  await check('C. join with correct secret -> joined', async () => {
    const { msg, ws } = await joinOnce({ meetingId: createdId, secret: createdSecret, nick: 'correct' });
    assertEqual('joined', msg && msg.t, JSON.stringify(msg));
    goodWs = ws;
  });
  if (goodWs) { try { goodWs.close(); } catch { /* ignore */ } }

  // D. secret 누락 join -> error, 이후 loc 보내도 state 미수신
  await check('D. join without secret -> error, then loc does not yield state broadcast', async () => {
    const { msg, ws } = await joinOnce({ meetingId: createdId, secret: undefined, nick: 'nosecret' });
    assertEqual('error', msg && msg.t, JSON.stringify(msg));
    const gotState = await sendLocAndWaitForState(ws, { lat: 37.5, lng: 127.0 }, 500);
    assertEqual(false, gotState, 'no state message received after loc (not in room)');
    try { ws.close(); } catch { /* ignore */ }
  });

  // E. 값이 다른 secret으로 join -> error
  await check('E. join with wrong-value secret -> error', async () => {
    const wrongSecret = (createdSecret[0] === 'A' ? 'B' : 'A') + createdSecret.slice(1);
    const { msg, ws } = await joinOnce({ meetingId: createdId, secret: wrongSecret, nick: 'wrong' });
    assertEqual('error', msg && msg.t, JSON.stringify(msg));
    try { ws.close(); } catch { /* ignore */ }
  });

  // F. 임시 DATA_FILE에 secret이 영속됐는지 확인
  await check('F. secret persisted to DATA_FILE', async () => {
    await sleep(300);
    const arr = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const found = arr.find(m => m.id === createdId);
    assertTrue(!!found, 'entry with matching id exists in DATA_FILE', JSON.stringify(arr));
    assertEqual(createdSecret, found && found.secret, 'persisted secret matches created secret');
  });

  // G. index.html inline script가 문법적으로 유효
  await check('G. index.html inline <script> is syntactically valid', async () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const match = html.match(/<script>([\s\S]*?)<\/script>/);
    assertTrue(!!match, 'inline <script> block found', 'no match');
    const body = match[1];
    try {
      // eslint-disable-next-line no-new-func
      new Function(body);
    } catch (e) {
      const err = new Error('SyntaxError');
      err.__checkFailure = true;
      err.expected = 'no SyntaxError';
      err.actual = String(e);
      throw err;
    }
  });

  // H. rate limit — 반드시 마지막에 실행 (해당 IP의 실패 예산을 소모함)
  if (process.env.CHECK_RATE_LIMIT === '1') {
    let rateLimitMsg = null;
    let mismatchMsg = null;

    await check('H. repeated join failures trigger per-IP rate limiting', async () => {
      const wrongSecret = (createdSecret[0] === 'A' ? 'B' : 'A') + createdSecret.slice(1);

      // 먼저 E에서 쓰인 "불일치" 메시지를 한 번 더 확보(비교 기준)
      {
        const { msg, ws } = await joinOnce({ meetingId: createdId, secret: wrongSecret, nick: 'rl-baseline' });
        mismatchMsg = msg && msg.msg;
        try { ws.close(); } catch { /* ignore */ }
      }

      for (let i = 0; i < 25; i++) {
        const { msg, ws } = await joinOnce({ meetingId: createdId, secret: wrongSecret, nick: `rl-${i}` });
        try { ws.close(); } catch { /* ignore */ }
        if (msg && msg.t === 'error' && msg.msg !== mismatchMsg) {
          rateLimitMsg = msg.msg;
          break;
        }
      }
      assertTrue(!!rateLimitMsg, 'at least one error response with a distinct rate-limit message', 'none found in 25 attempts');

      const { msg: afterMsg, ws: afterWs } = await joinOnce({ meetingId: createdId, secret: createdSecret, nick: 'rl-after' });
      try { afterWs.close(); } catch { /* ignore */ }
      assertEqual('error', afterMsg && afterMsg.t, JSON.stringify(afterMsg));
    });
  } else {
    console.log('SKIP: H. rate limiting (set CHECK_RATE_LIMIT=1 to run)');
  }

  console.log('ALL PASS');
  cleanup();
  process.exit(0);
}

main().catch(e => {
  console.error('UNEXPECTED ERROR:', e);
  cleanup();
  process.exit(1);
});
