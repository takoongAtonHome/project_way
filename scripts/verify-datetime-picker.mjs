#!/usr/bin/env node
/* ============================================================
   verify-datetime-picker.mjs
   index.html의 날짜/시간 네이티브 피커 전환을 검증하는 회귀 스크립트.
   브라우저 없이 DATETIME-HELPERS 구획을 추출해 new Function으로 평가하고,
   실제 서버를 띄워 date/time opaque 문자열 round-trip을 확인한다.
   Node 빌트인만 사용한다 (신규 의존성 없음).

   실행: node scripts/verify-datetime-picker.mjs
   ============================================================ */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const PORT = 8700 + Math.floor(Math.random() * 400);
const DATA_FILE = path.join(os.tmpdir(), `wj-dt-verify-${PORT}.json`);
const BASE_URL = `http://localhost:${PORT}`;

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

/** index.html에서 DATETIME-HELPERS:START ~ END 사이 소스를 잘라내
 *  순수 헬퍼 함수 이름들을 담은 객체로 평가해 반환한다.
 *  마커가 없으면 명확한 실패와 함께 throw한다. 아직 정의되지 않은 이름은
 *  ReferenceError 대신 undefined로 채워 개별 check가 독립적으로 실패하게 한다. */
const HELPER_NAMES = ['isISODate', 'isISOTime', 'fmtDateKo', 'fmtTimeKo', 'roundTimeTo5', 'nextSaturdayISO'];

function extractDatetimeHelpers(html) {
  const startMarker = 'DATETIME-HELPERS:START';
  const endMarker = 'DATETIME-HELPERS:END';
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    const err = new Error('DATETIME-HELPERS 마커를 찾을 수 없습니다');
    err.__checkFailure = true;
    err.expected = 'DATETIME-HELPERS:START / :END 마커가 index.html에 존재';
    err.actual = `startIdx=${startIdx}, endIdx=${endIdx}`;
    throw err;
  }
  // 마커는 (여러 줄일 수 있는) 블록 주석(/* ... */) 안에 있으므로, 그 주석이 끝나는 `*/`
  // 다음부터 시작 슬라이스를 잡고, 끝 마커 주석이 시작되는 `/*` 앞까지만 끝 슬라이스를 잡는다.
  // 그래야 잘려나간 `/*`/`*/` 조각이 구문 오류나 의도치 않은 주석 스와핑을 일으키지 않는다.
  const startCommentClose = html.indexOf('*/', startIdx);
  const afterStartComment = startCommentClose === -1 ? startIdx : startCommentClose + 2;
  const endCommentOpen = html.lastIndexOf('/*', endIdx);
  const beforeEndComment = endCommentOpen === -1 ? endIdx : endCommentOpen;
  const src = html.slice(afterStartComment, beforeEndComment);
  const returnStmt = `\nreturn { ${HELPER_NAMES.map(n => `${n}: (typeof ${n} !== 'undefined' ? ${n} : undefined)`).join(', ')} };\n`;
  // eslint-disable-next-line no-new-func
  const factory = new Function(src + returnStmt);
  return factory();
}

async function main() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  // A. 네이티브 피커 속성
  await check('A. f_date is type="date", f_time is type="time" step="300"', async () => {
    const dateMatch = html.match(/<input[^>]*id="f_date"[^>]*>/);
    const timeMatch = html.match(/<input[^>]*id="f_time"[^>]*>/);
    assertTrue(!!dateMatch, 'f_date input found', 'no match');
    assertTrue(!!timeMatch, 'f_time input found', 'no match');
    assertTrue(/type="date"/.test(dateMatch[0]), 'f_date has type="date"', dateMatch[0]);
    assertTrue(/type="time"/.test(timeMatch[0]), 'f_time has type="time"', timeMatch[0]);
    assertTrue(/step="300"/.test(timeMatch[0]), 'f_time has step="300"', timeMatch[0]);
  });

  // B. 순수 포맷 함수
  const helpers = extractDatetimeHelpers(html);

  await check('B1. fmtDateKo(2025-07-26) === "7월 26일 (토)"', async () => {
    assertTrue(typeof helpers.fmtDateKo === 'function', 'fmtDateKo is a function', typeof helpers.fmtDateKo);
    assertEqual('7월 26일 (토)', helpers.fmtDateKo('2025-07-26'));
  });
  await check('B2. fmtDateKo(2026-09-05) === "9월 5일 (토)" (no leading zero)', async () => {
    assertEqual('9월 5일 (토)', helpers.fmtDateKo('2026-09-05'));
  });
  await check('B3. fmtTimeKo(19:00) === "오후 7:00"', async () => {
    assertTrue(typeof helpers.fmtTimeKo === 'function', 'fmtTimeKo is a function', typeof helpers.fmtTimeKo);
    assertEqual('오후 7:00', helpers.fmtTimeKo('19:00'));
  });
  await check('B4. fmtTimeKo(09:05) === "오전 9:05"', async () => {
    assertEqual('오전 9:05', helpers.fmtTimeKo('09:05'));
  });
  await check('B5. fmtTimeKo(00:30) === "오전 12:30"', async () => {
    assertEqual('오전 12:30', helpers.fmtTimeKo('00:30'));
  });
  await check('B6. fmtTimeKo(12:00) === "오후 12:00"', async () => {
    assertEqual('오후 12:00', helpers.fmtTimeKo('12:00'));
  });
  await check('B7. malformed input yields empty string', async () => {
    assertEqual('', helpers.fmtDateKo('7월 26일 (토)'));
    assertEqual('', helpers.fmtTimeKo('오후 7:00'));
  });
  await check('B8. angle-bracket input yields empty string (XSS guard)', async () => {
    assertEqual('', helpers.fmtDateKo('2025-07-26<b>'));
  });

  // C. 인라인 스크립트 전체가 구문상 유효
  await check('C. index.html inline <script> is syntactically valid', async () => {
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

  // D. 서버 round-trip으로 opaque 문자열 계약 유지 확인
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

  let roundTripDate = null;
  let roundTripTime = null;

  await check('D. POST/GET /api/meetings preserves date/time verbatim (opaque contract)', async () => {
    const postRes = await fetch(`${BASE_URL}/api/meetings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '검증모임', place: '강남역', date: '2026-09-05', time: '19:00', dest: null }),
    });
    const postJson = await postRes.json();
    assertTrue(typeof postJson.id === 'string' && postJson.id.length > 0, 'string id', JSON.stringify(postJson));

    const getRes = await fetch(`${BASE_URL}/api/meetings/${postJson.id}`);
    assertEqual(200, getRes.status, 'GET status 200');
    const getJson = await getRes.json();
    assertEqual('2026-09-05', getJson.date, 'date preserved verbatim');
    assertEqual('19:00', getJson.time, 'time preserved verbatim');
    roundTripDate = getJson.date;
    roundTripTime = getJson.time;
  });

  console.log('ALL PASS');
  cleanup();
  process.exit(0);
}

main().catch(e => {
  console.error('UNEXPECTED ERROR:', e);
  cleanup();
  process.exit(1);
});
