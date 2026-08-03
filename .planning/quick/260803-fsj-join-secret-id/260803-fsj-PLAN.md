---
phase: quick-260803-fsj
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - server.js
  - index.html
  - package.json
  - scripts/verify-join-secret.mjs
autonomous: true
requirements: [VERIFY-01, VERIFY-03]

must_haves:
  truths:
    - "초대 링크(`?m=<id>&k=<secret>`)로 들어온 참여자는 추가 입력 없이 닉네임만으로 기존과 동일하게 입장한다"
    - "링크의 `k`(secret)가 없거나 틀리면 WebSocket join이 거부되고 해당 소켓은 room에 들어가지 못해 참여자 좌표/state 브로드캐스트를 받지 못한다"
    - "짧은 시간 내 동일 IP에서 join 실패가 반복되면 이후 join 시도가 일정 시간 차단된다"
    - "GET /api/meetings/:id 응답 본문에 secret 값이 포함되지 않는다"
    - "서버 재시작(data.json 재로드) 후에도 저장된 secret으로 기존 초대 링크가 계속 동작한다"
  artifacts:
    - "server.js — secret 생성/영속/상수시간 검증 + per-IP join 실패 rate limit"
    - "index.html — 초대 링크에 k 포함, join 메시지에 secret 포함, referrer 정책 meta"
    - "scripts/verify-join-secret.mjs — 실제 서버를 띄워 검증하는 자동 스크립트"
    - "package.json — verify:join-secret npm script"
  key_links:
    - "POST /api/meetings 응답의 secret → MEETING.secret → inviteLink()의 `k` 파라미터"
    - "URL `k` 파라미터 → gotoJoin(id, secret) → MEETING.secret → openWS join 페이로드의 secret"
    - "join 페이로드 secret → 서버의 m.secret 상수시간 비교 → m.room 입장 허용/거부"
    - "saveMeetings/loadMeetings의 필드 화이트리스트 → 재시작 후 secret 유지"
---

<objective>
모임 참여(join) 경로에 초대 링크 전용 secret 토큰 검증을 추가해, 6자리 모임 ID(`36^6`)를 무작위 대입하는 것만으로 남의 모임 실시간 위치를 볼 수 있는 취약점을 막는다.

Purpose: Phase 3 실기기 검증에서 실제 친구들의 GPS 좌표가 흐르기 전에, 링크를 받지 않은 제3자가 실시간 위치를 관측할 수 없도록 보장한다. 사용자 마찰(비밀번호 입력)은 0으로 유지한다 — secret은 링크 안에 이미 들어있고 프론트가 자동으로 읽어 보낸다.
Output: secret 생성/영속/검증이 적용된 server.js, 링크·join 페이로드에 secret을 실어 보내는 index.html, 그리고 이 동작을 회귀 검증하는 자동 스크립트.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.claude/CLAUDE.md

@server.js
@index.html
@package.json
</context>

<interface_context>
현재 코드 기준 사실(구현 전 확인된 상태):

- `server.js`
  - `meetings: Map<id, {id,name,place,date,time,dest,room:Set<ws>}>`, `genId = () => Math.random().toString(36).slice(2,8)`
  - `loadMeetings()` — DATA_FILE의 배열을 읽어 `meetings.set(m.id, {...m, room:new Set()})`
  - `saveMeetings()` — `{ id, name, place, date, time, dest }` 만 골라 `fs.writeFile`로 저장 (필드 화이트리스트)
  - `POST /api/meetings` — 현재 `res.json({ id })` 만 응답
  - `GET /api/meetings/:id` — `{ id, name, place, date, time, dest, count }` 화이트리스트 응답 (secret 없음이 기본값)
  - `wss.on('connection', ws => ...)` — **현재 `req` 인자를 받지 않음**. `msg.t === 'join'` 분기에서 `meetings.get(msg.meetingId)` 존재 여부만 확인하고 바로 `m.room.add(ws)`
  - Node 22 (Dockerfile: `node:22-alpine`), 의존성은 `express`, `ws` 뿐. `crypto`는 Node 빌트인이라 설치 불필요.
  - `data.json`은 `.gitignore`에 포함된 로컬 테스트 데이터이며, 현재 secret 없는 모임 4건이 들어있다.
- `index.html` — inline `<script>` 블록이 **정확히 1개** (229–569행), `src` 속성 없음.
  - `let MEETING=null` / `createMeeting()`은 `MEETING={...info, id:res.id, dest}` 후 `renderInvite(res.id)`
  - `inviteLink(id)` → `location.origin+'/?m='+id`
  - `renderInvite(id)`, `openAsGuest()`가 `inviteLink()` 사용
  - `parseMeetingId(s)` — `/[?&]m=([a-z0-9]+)/i` 매치, 실패 시 입력 전체를 id로 취급. `joinByCode()`에서 사용.
  - `gotoJoin(id)` — `GET /api/meetings/{id}` 후 `MEETING={name,place,date,time,id,dest}`
  - 딥링크 IIFE (294행) — `new URLSearchParams(location.search).get('m')` 만 읽음
  - `openWS(nick)` — `ws.onopen`에서 `{t:'join', meetingId:MEETING.id, nick}` 전송
  - mock(데모) 모드는 WebSocket을 열지 않으므로 이 변경의 영향을 받지 않는다.
  - `<head>`는 4–7행 (charset / viewport / theme-color / title)
</interface_context>

<tasks>

<task type="auto">
  <name>Task 1: 자동 검증 스크립트 작성 (RED — 아직 실패해야 정상)</name>
  <files>scripts/verify-join-secret.mjs, package.json</files>
  <action>
실제 서버 프로세스를 띄워 join 보안 동작을 검증하는 ESM 스크립트를 새로 만든다. 의존성 추가 없이 이미 있는 `ws`의 클라이언트(`import { WebSocket } from 'ws'`)와 Node 빌트인(`node:child_process`, `node:fs`, `node:os`, `node:path`)만 사용한다.

스크립트 골격:
- 시작 시 `PORT = 8300 + Math.floor(Math.random()*400)`, `DATA_FILE = path.join(os.tmpdir(), 'wj-verify-'+PORT+'.json')` 를 정하고 `spawn('node', ['server.js'], { cwd: 프로젝트 루트, env: { ...process.env, PORT, DATA_FILE }, stdio: 'pipe' })` 로 서버를 띄운다.
- `GET /api/meetings/__none__` 이 404를 돌려줄 때까지 100ms 간격 최대 50회 폴링해 기동을 대기한다. 초과 시 서버 stdout/stderr를 출력하고 실패로 종료한다.
- 각 검증은 `check(label, fn)` 헬퍼로 감싸고, 실패 시 라벨과 기대/실제값을 출력한 뒤 즉시 종료 코드 1로 끝낸다. 전부 통과하면 `ALL PASS` 를 출력하고 0으로 끝낸다.
- `try/finally` 와 `process.on('exit')` 양쪽에서 자식 프로세스 kill 및 임시 DATA_FILE 삭제를 보장한다.
- WS 헬퍼 `joinOnce({ meetingId, secret, nick })` — 서버 `/ws` 에 접속해 join 메시지를 보내고 첫 응답 메시지 1건을 파싱해 반환한다(1500ms 타임아웃). `secret` 인자가 `undefined` 면 페이로드에서 해당 키를 아예 빼고 보낸다.

검증 항목(A~G는 항상 실행, H는 `process.env.CHECK_RATE_LIMIT === '1'` 일 때만 실행하고 그 외에는 `SKIP` 출력):
- A. `POST /api/meetings` 응답 JSON에 `id` 와 문자열 `secret` 이 있고, secret이 `/^[A-Za-z0-9_-]{20,}$/` 를 만족한다.
- B. `GET /api/meetings/{id}` 가 200이고, 응답 **원문 텍스트**에 A에서 받은 secret 값이 부분문자열로 등장하지 않으며, 파싱한 객체에 `secret` 키가 없다.
- C. 올바른 secret으로 join → 첫 응답의 `t` 가 `joined`.
- D. secret 키를 생략하고 join → 첫 응답의 `t` 가 `error`. 이어서 같은 소켓으로 `{t:'loc', lat:37.5, lng:127.0}` 를 보내고 500ms 동안 `t === 'state'` 메시지가 오지 않음을 확인한다(room 미입장 증명).
- E. 형식은 맞지만 값이 다른 secret(예: A의 secret 문자열 첫 글자를 다른 문자로 바꾼 값)으로 join → 첫 응답의 `t` 가 `error`.
- F. 300ms 대기 후 임시 DATA_FILE을 읽어, `id` 가 일치하는 항목의 `secret` 이 A에서 받은 값과 같다.
- G. `index.html` 을 읽어 유일한 inline `<script>...</script>` 블록 본문을 추출하고 `new Function(body)` 로 컴파일한다(실행하지 않음). SyntaxError가 나면 실패 — 프론트 편집 후 문법 파손 감지용.
- H. (rate limit — **반드시 마지막에 실행**, 해당 IP의 실패 예산을 소모하므로) 잘못된 secret으로 join을 25회 순차 시도하고, 응답 중 최소 1건이 `t === 'error'` 이면서 `msg` 가 E에서 받은 "초대 링크 불일치" 메시지와 **다른** 문자열(=rate limit 메시지)임을 확인한다. 그 직후 **올바른** secret으로 join을 시도해도 `t === 'error'` 로 거부되는지 확인한다(차단 창이 실제로 열려 있음을 증명).

`package.json` 의 `scripts` 에 `"verify:join-secret": "node scripts/verify-join-secret.mjs"` 를 추가한다. 의존성은 추가하지 않는다.

이 시점에는 서버에 secret 개념이 없으므로 A에서 실패하는 것이 정상이다.
  </action>
  <verify>
    <automated>node --check scripts/verify-join-secret.mjs &amp;&amp; ! npm run --silent verify:join-secret</automated>
  </verify>
  <done>스크립트가 문법 오류 없이 파싱되고, 실행하면 A 항목 라벨을 출력하며 종료 코드 1로 실패한다(서버 프로세스와 임시 파일은 남지 않는다). `npm run verify:join-secret` 로 실행 가능하다.</done>
</task>

<task type="tracer" tdd="true">
  <name>Task 2: secret 생성 → 링크 → join 검증 end-to-end 연결</name>
  <files>server.js, index.html</files>
  <behavior>
Task 1 스크립트의 A~G가 모두 통과해야 한다:
- POST /api/meetings 가 20자 이상 URL-safe secret을 함께 반환
- GET /api/meetings/:id 응답에는 secret이 전혀 등장하지 않음
- 올바른 secret join → `joined`
- secret 누락 join → `error` + 이후 `loc` 을 보내도 `state` 브로드캐스트 수신 없음
- 값이 틀린 secret join → `error`
- data.json 재저장분에 secret 포함
- index.html inline script가 문법적으로 유효
  </behavior>
  <action>
**server.js**

1. 파일 상단 require 목록에 Node 빌트인 `crypto` 를 추가한다(`const crypto = require('crypto')`). 새 npm 패키지는 설치하지 않는다.
2. `genId` 옆에 `const genSecret = () => crypto.randomBytes(24).toString('base64url');` 를 추가한다 — 32자 URL-safe 문자열이며 `36^6` 짧은 id와 달리 무작위 대입이 불가능하다. 짧은 id는 표시/URL 용도로 **그대로 유지**한다(교체하지 않는다).
3. 상수시간 비교 헬퍼 `secretMatches(given, expected)` 를 추가한다: 두 값이 모두 비어있지 않은 문자열이고 `Buffer.byteLength` 가 같을 때만 `crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))` 를 반환하고, 그 외에는 `false` 를 반환한다(길이가 다르면 timingSafeEqual이 throw하므로 반드시 길이 확인 선행).
4. `POST /api/meetings` — `const secret = genSecret();` 를 만들어 `meetings.set(id, {...})` 객체에 `secret` 필드로 넣고, 응답을 `res.json({ id, secret })` 으로 바꾼다. 생성 로그 줄에 출력하는 필드는 지금과 동일하게(모임 id·이름·장소) 유지하고 새 값을 덧붙이지 않는다.
5. `saveMeetings()` — 저장 필드 화이트리스트에 `secret` 을 추가해 `{ id, name, place, date, time, dest, secret }` 이 파일에 기록되게 한다.
6. `loadMeetings()` — 로드한 모임 중 문자열 secret이 없는 항목에는 `genSecret()` 로 새 값을 채워 넣는다(backfill). backfill된 건수가 1 이상이면 `saveMeetings()` 를 호출하고 몇 건을 보정했는지 한 줄 로그를 남긴다. 결과적으로 "모든 모임은 secret을 가진다"는 불변식이 성립한다. 부작용으로 secret 없이 발급됐던 기존 링크는 더 이상 입장할 수 없다 — data.json은 `.gitignore` 된 로컬 테스트 데이터이므로 배포 전 MVP 단계에서 수용한다(fail-closed 선택).
7. `GET /api/meetings/:id` — 응답 필드 화이트리스트를 **변경하지 않는다**. 새 필드를 추가하지 말 것(현재 구조가 이미 secret을 제외한다).
8. WebSocket `msg.t === 'join'` 분기 — 기존 "모임을 찾을 수 없어요" 체크 **직후**, `m.room.add(ws)` 및 `ws.meetingId`/`ws.p` 대입보다 **앞에서** `secretMatches(msg.secret, m.secret)` 를 검사한다. false면 `{ t:'error', msg:'초대 링크가 올바르지 않아요' }` 를 전송하고 `return` 한다 — 이때 `ws.meetingId`/`ws.p` 는 건드리지 않고 room에도 넣지 않아, 이후 `loc` 메시지가 와도 브로드캐스트 대상이 되지 않는다.

**index.html** (inline script는 1개뿐이므로 그 안에서 편집)

9. `<head>` 에 `<meta name="referrer" content="strict-origin-when-cross-origin" />` 를 추가한다 — 카카오 SDK 스크립트/이미지 등 cross-origin 요청에 secret이 들어있는 전체 URL이 Referer로 새어나가지 않도록 브라우저 기본값을 명시적으로 고정한다.
10. `inviteLink(id, secret)` 로 시그니처를 바꾸고 `location.origin + '/?m=' + encodeURIComponent(id) + '&k=' + encodeURIComponent(secret)` 를 반환한다.
11. `createMeeting()` — 서버 응답의 secret을 `MEETING={...info, id:res.id, secret:res.secret, dest}` 로 보관하고 `renderInvite(res.id, res.secret)` 를 호출한다.
12. `renderInvite(id, secret)` 로 시그니처를 바꿔 `inviteLink(id, secret)` 결과를 `#inviteLink` 텍스트에 넣는다. `copyInvite()` 는 그 텍스트를 그대로 복사하므로 수정 불필요.
13. `openAsGuest()` — `MEETING.id` 와 `MEETING.secret` 을 함께 확인해 둘 중 하나라도 없으면 기존과 같은 안내 토스트를 띄우고 중단하며, 있으면 `inviteLink(id, secret)` 를 새 창으로 연다.
14. `parseMeetingId(s)` 를 `parseInvite(s)` 로 대체해 `{ id, secret }` 을 반환하게 한다: 입력에서 `/[?&]m=([A-Za-z0-9]+)/` 와 `/[?&]k=([A-Za-z0-9_-]+)/` 를 각각 매치하고 `decodeURIComponent` 로 풀며, `m=` 자체가 없으면 `{ id: 입력값 trim, secret: null }` 을 반환한다. `joinByCode()` 는 `parseInvite` 결과를 구조분해해 `gotoJoin(id, secret)` 로 넘긴다(프롬프트 문구는 그대로 두어 링크 붙여넣기 UX를 유지한다).
15. `gotoJoin(id, secret)` 로 시그니처를 바꾸고, 조회 성공 시 `MEETING` 객체에 `secret` 을 함께 저장한다. `GET /api/meetings/:id` 호출 방식은 바꾸지 않는다(메타데이터 조회는 secret을 요구하지 않는다).
16. 딥링크 IIFE(294행 부근) — `URLSearchParams` 에서 `m` 과 `k` 를 모두 읽어 `gotoJoin(id, k)` 로 넘긴다.
17. `openWS(nick)` — `ws.onopen` 의 join 페이로드에 `secret: MEETING.secret` 를 추가한다. `t`, `meetingId`, `nick` 키는 유지한다. 사용자에게 추가 입력을 요구하는 UI는 절대 만들지 않는다(값은 URL에서 자동으로 읽힌 것만 사용).

mock(데모) 모드 경로와 닉네임 입력 UX(`joinNow`, `enterMeeting`)는 손대지 않는다.
  </action>
  <verify>
    <automated>npm run --silent verify:join-secret &amp;&amp; test $(grep -cE "t:'join'[^}]*secret" index.html) -ge 1 &amp;&amp; test $(grep -cE "'&amp;k='" index.html) -ge 1</automated>
  </verify>
  <done>검증 스크립트가 A~G를 모두 통과해 `ALL PASS` 로 종료 코드 0을 반환한다(H는 SKIP). index.html의 join 페이로드에 secret이 실려 있고 초대 링크가 `&k=` 파라미터를 포함한다. 사용자는 여전히 닉네임만 입력한다.</done>
</task>

<task type="auto">
  <name>Task 3: join 실패에 대한 per-IP rate limiting</name>
  <files>server.js</files>
  <action>
무작위 대입 시도 자체의 비용을 올리기 위해 WebSocket join 실패에 대한 IP 단위 슬라이딩 윈도 제한을 추가한다.

1. 상단 상수로 `JOIN_FAIL_MAX = 20`, `JOIN_FAIL_WINDOW_MS = 60000` 를 두고 `const joinFails = new Map()` (key: 클라이언트 IP, value: `{ count, firstAt }`)을 선언한다. 정상 사용자는 링크에 담긴 값을 자동으로 보내므로 실패가 거의 발생하지 않는다 — 여러 친구가 같은 NAT/이동통신 IP를 공유하는 상황을 고려해 임계값을 넉넉히 잡는다.
2. `clientIpOf(req)` 헬퍼를 추가한다: `req.headers['x-forwarded-for']` 가 있으면 콤마로 분리한 **첫 번째** 항목을 trim해서 쓰고, 없으면 `req.socket.remoteAddress` 를 쓴다(Render 등 프록시 뒤에서 실제 클라이언트 IP를 얻기 위함).
3. `wss.on('connection', ...)` 콜백이 두 번째 인자 `req` 를 받도록 시그니처를 바꾸고, 연결 시 `ws.clientIp = clientIpOf(req)` 를 저장한다. 기존 `ws.meetingId = null; ws.p = null;` 초기화는 유지한다.
4. `isJoinBlocked(ip)` — `joinFails` 항목이 없으면 false. 있고 `Date.now() - firstAt > JOIN_FAIL_WINDOW_MS` 면 항목을 삭제하고 false(윈도 만료). 그 외에는 `count >= JOIN_FAIL_MAX` 를 반환한다.
5. `recordJoinFail(ip)` — 항목이 없거나 윈도가 만료됐으면 `{ count: 1, firstAt: Date.now() }` 로 새로 만들고, 아니면 `count` 를 1 증가시킨다.
6. `join` 분기 맨 앞(모임 조회보다 먼저)에서 `isJoinBlocked(ws.clientIp)` 이면 `{ t:'error', msg:'요청이 너무 많아요. 잠시 후 다시 시도해 주세요' }` 를 보내고 `return` 한다. 이 문구는 초대 링크 불일치 메시지와 **서로 다른 문자열**이어야 한다(검증 스크립트 H가 두 경우를 구분한다).
7. 모임을 찾지 못한 경우와 secret 검증 실패한 경우 모두 응답 전송 직전 또는 직후에 `recordJoinFail(ws.clientIp)` 를 호출한다. join이 성공하면 `joinFails.delete(ws.clientIp)` 로 카운터를 초기화한다.
8. 맵이 무한히 커지지 않도록 `setInterval` 로 `JOIN_FAIL_WINDOW_MS` 주기의 sweep을 돌려 만료된 항목을 지우고, 반환된 타이머에 `.unref()` 를 호출한다(테스트/스크립트가 프로세스 종료를 기다리며 멈추지 않도록).
  </action>
  <verify>
    <automated>CHECK_RATE_LIMIT=1 npm run --silent verify:join-secret</automated>
  </verify>
  <done>검증 스크립트가 A~H 전부 통과해 종료 코드 0을 반환한다. 잘못된 secret으로 반복 시도한 IP는 윈도 동안 올바른 secret으로도 join이 거부되고, 윈도 만료 후에는 다시 정상 입장한다. 스크립트 실행 후 서버 프로세스가 타이머 때문에 남아있지 않다.</done>
  <human-check>
브라우저 수동 확인 (배포 전 로컬, `npm start`):
1. `http://localhost:8000` 에서 모임을 만들고 초대 링크에 `?m=...&k=...` 두 파라미터가 모두 보이는지 확인한다.
2. 그 링크를 시크릿 창에 붙여넣고 **닉네임만** 입력해 입장 → 지도/참여자 목록이 이전과 동일하게 뜬다(추가 입력 요구 없음).
3. 같은 링크에서 `&k=...` 부분만 지우고 다시 열어 닉네임 입력 후 입장 시도 → "초대 링크가 올바르지 않아요" 토스트가 뜨고 참여자 목록에 내가 추가되지 않는다(첫 창에서도 인원 수가 늘지 않는다).
4. 서버를 재시작한 뒤 2번의 원본 링크로 다시 입장 → 정상 입장(secret 영속 확인).
  </human-check>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → `POST/GET /api/meetings` | 미인증 공개 REST 표면. 모임 id는 6자 base36(`36^6`)으로 열거 가능 |
| browser → WebSocket `/ws` (`join`/`loc`/`stop`) | 미인증 실시간 표면. 여기가 실제 GPS 좌표가 흐르는 지점 — 이 플랜의 주 방어선 |
| server → `data.json` (디스크) | 평문 영속화. `.gitignore` 대상 로컬 파일 |
| server → Kakao Mobility / browser → Kakao Maps SDK | 외부 cross-origin 호출 (Referer 누출 경로) |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-QS-01 | Spoofing | `wss` `msg.t==='join'` 핸들러 (server.js) | high | mitigate | Task 2-8: `crypto.randomBytes(24).toString('base64url')` 32자 secret을 `crypto.timingSafeEqual` 로 상수시간 비교한 뒤에만 `m.room` 입장 허용. 불일치 시 `ws.p`/`ws.meetingId` 미설정 → `loc` 브로드캐스트 대상에서도 제외 |
| T-QS-02 | Information Disclosure | `GET /api/meetings/:id` | medium | accept | 응답은 name/place/date/time/dest/count 화이트리스트로 secret과 참여자 좌표를 전혀 포함하지 않는다. 다만 id를 맞힌 공격자는 모임 메타데이터는 읽을 수 있다. 요청 범위(join 게이팅 최우선)와 "코드/링크 붙여넣기" UX 유지를 위해 ASVS L1 수준에서 수용하고 후속 항목으로 기록 (`<notes>` 참조) |
| T-QS-03 | Denial of Service | WS join 핸들러 (무작위 대입 / 실패 폭주) | medium | mitigate | Task 3: IP당 60초 20회 실패 슬라이딩 윈도로 join 시도 차단 + 주기적 sweep(`unref`)으로 카운터 맵 무한 증가 방지. 성공 시 카운터 리셋으로 정상 사용자 영향 최소화 |
| T-QS-04 | Information Disclosure | 초대 링크 URL의 `k` 파라미터 (Referer / 브라우저 이력 / 링크 미리보기) | medium | mitigate | Task 2-9: `<meta name="referrer" content="strict-origin-when-cross-origin">` 로 cross-origin 요청에 전체 URL이 실려 나가지 않도록 명시. 링크 공유 자체는 제품의 핵심 메커니즘(무설치·무가입)이고 secret은 단일 모임 범위의 임시 capability이므로 잔여 위험 수용 |
| T-QS-05 | Information Disclosure | `data.json` 평문 secret / 서버 stdout | low | accept | secret은 `.gitignore` 된 로컬 파일에 평문 저장되고, 생성 로그에는 모임 id·이름·장소만 남긴다(Task 2-4에서 로그 필드 변경 금지). 단일 테넌트 MVP 수준에서 수용 |
| T-QS-SC | Tampering | npm/pip/cargo installs | low | accept | 이 플랜은 새 패키지를 설치하지 않는다 — 추가되는 것은 Node 빌트인 `crypto` 뿐이고 `express`/`ws` 는 기존 의존성이다. 따라서 공급망 검증 체크포인트 불필요 |
</threat_model>

<verification>
1. `npm run verify:join-secret` → `ALL PASS` (A~G, H는 SKIP), 종료 코드 0
2. `CHECK_RATE_LIMIT=1 npm run verify:join-secret` → `ALL PASS` (A~H), 종료 코드 0
3. `node --check server.js` 통과
4. `grep -cE "t:'join'[^}]*secret" index.html` ≥ 1 (프론트 join 페이로드에 secret 존재)
5. `grep -cE "'&k='" index.html` ≥ 1 (초대 링크에 k 파라미터 존재)
6. Task 3의 `<human-check>` 4단계 브라우저 확인
</verification>

<success_criteria>
- 링크를 받지 않은 제3자는 모임 id를 알아내도 WebSocket join에 실패하고 어떤 참여자 좌표도 수신하지 못한다
- 링크를 받은 사용자는 닉네임 하나만 입력하는 기존 UX 그대로 입장한다 — 추가 입력 필드/단계가 생기지 않는다
- secret은 POST /api/meetings 응답(생성자 본인)에서만 노출되고, GET 조회 응답·브로드캐스트 payload·서버 로그에는 나타나지 않는다
- secret이 data.json에 영속되어 서버 재시작 후에도 기존 링크가 동작한다
- 동일 IP의 반복 join 실패가 60초 윈도로 차단된다
- 새 npm 의존성이 추가되지 않는다
</success_criteria>

<notes>
**후속 항목 (이 플랜 범위 밖, T-QS-02 관련):** `GET /api/meetings/:id` 도 `k` 를 요구하도록 만들면 메타데이터 열거까지 막을 수 있으나, "코드만 붙여넣기"로 참여하는 기존 경로(`joinByCode`)가 깨지므로 이번에는 하지 않았다. 실시간 위치 보호(T-QS-01)가 최우선 목표이고 그것은 달성된다. 필요해지면 별도 quick 작업으로 처리한다.

**data.json 영향:** 기존 4건의 secret 없는 모임에는 로드 시 새 secret이 부여되어(fail-closed) 예전 링크로는 입장할 수 없다. `data.json` 은 `.gitignore` 대상 로컬 테스트 데이터이므로 배포 전 MVP 단계에서 문제 없다.
</notes>

<output>
Create `.planning/quick/260803-fsj-join-secret-id/260803-fsj-SUMMARY.md` when done
</output>
