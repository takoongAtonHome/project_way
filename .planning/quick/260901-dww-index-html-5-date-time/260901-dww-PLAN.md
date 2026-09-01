---
phase: quick-260901-dww
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - index.html
  - package.json
  - scripts/verify-datetime-picker.mjs
autonomous: true
requirements: [VERIFY-03]

must_haves:
  truths:
    - "모임 만들기 화면에서 날짜/시간은 타이핑이 아니라 네이티브 피커(달력/시간 휠)로 선택한다"
    - "시간 피커에서 5분 단위가 아닌 시각(예: 07:03)을 고르면 자동으로 가장 가까운 5분 단위(07:05)로 보정되어 입력값에 다시 반영된다 — 모바일 1분 휠에서도 동작한다"
    - "저장/전송/재적용되는 값은 항상 ISO 형식(date=`YYYY-MM-DD`, time=`HH:MM` 24시간제)이다"
    - "화면에 사람이 읽는 표시는 기존과 동일한 한국어 포맷(`7월 26일 (토)`, `오후 7:00`)으로 보인다 — 초대 카드, 참여 카드, 지도 상단 서브타이틀 모두"
    - "초대 링크로 들어온 참여자가 서버에서 받은 ISO 값을 그대로 재적용해도 네이티브 입력이 비지 않고 동일한 한국어 표시를 본다"
    - "server.js는 수정되지 않으며 date/time을 그대로 저장·반환하는 opaque 문자열 계약이 유지된다"
  artifacts:
    - "index.html — `<input type=\"date\" id=\"f_date\">` / `<input type=\"time\" step=\"300\" id=\"f_time\">`"
    - "index.html — DATETIME-HELPERS 구획 안의 순수 함수(`isISODate`/`isISOTime`/`fmtDateKo`/`fmtTimeKo`/`roundTimeTo5`/`nextSaturdayISO`)"
    - "scripts/verify-datetime-picker.mjs — 브라우저 없이 순수 함수를 추출·평가하고 실제 서버로 round-trip을 검증하는 자동 스크립트"
    - "package.json — verify:datetime-picker npm script"
  key_links:
    - "`<input type=date/time>` 의 `.value`(ISO) → `meetingText()` → `createMeeting()` → `POST /api/meetings` 본문의 date/time"
    - "`GET /api/meetings/:id` 의 ISO 문자열 → `applyISODateTime()` 가드 → `f_date`/`f_time` 의 `.value` → `renderCards()`"
    - "`f_time` 의 change/input 이벤트 → `roundTimeTo5()` → `f_time.value` 재기록 → 5분 단위 강제"
    - "ISO 값 → `fmtDateKo()`/`fmtTimeKo()` → `renderCards()` 의 infocard innerHTML 및 `m_sub` textContent"
    - "index.html 안의 DATETIME-HELPERS 시작/끝 마커 → verify 스크립트의 구획 추출 정규식 → `new Function` 평가"
---

<objective>
모임 만들기 화면(index.html)의 날짜/시간 입력을 자유 텍스트에서 네이티브 선택형 피커로 바꾸고, 저장값(ISO)과 표시값(한국어 포맷)을 분리한다. 모바일 시간 휠이 1분 단위라는 함정을 JS 반올림 보정으로 우회해 실제로 5분 단위만 저장되게 만든다.

Purpose: 지금은 `f_date`/`f_time` 이 그냥 텍스트라서 사용자가 아무 문자열이나 넣을 수 있고, 그 문자열이 그대로 서버에 저장돼 초대받은 사람 화면까지 흘러간다. 입력을 피커로 좁히면 (1) 오타·형식 혼란이 사라지고 (2) 값이 ISO로 정규화돼 초대 링크 round-trip이 깨지지 않으며 (3) 자유 문자열이 남의 카드 innerHTML까지 도달하던 경로가 형식 가드로 차단된다.
Output: 피커 입력 + ISO 저장 + 한국어 표시로 동작하는 index.html, 이를 회귀 검증하는 scripts/verify-datetime-picker.mjs, 그리고 npm script 등록.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/CLAUDE.md
@index.html
@scripts/verify-join-secret.mjs
@package.json
</context>

<key_facts>
실행 전에 반드시 알아야 할, 이미 확인된 사실 (다시 조사하지 말 것):

1. **server.js는 date/time을 파싱하지 않는다.** `POST /api/meetings` 는 `date: date || ''`, `time: time || ''` 로 저장하고 `GET /api/meetings/:id` 는 그대로 돌려준다. 스키마 변경 불필요. **이 작업에서 server.js는 수정하지 않는다.**

2. **요일 계산은 검증됨** (`new Date(y, m-1, d).getDay()` 로 실측):
   - `2025-07-26` → **토** (기존 목업 문자열 `7월 26일 (토)` 의 실제 출처)
   - `2026-07-26` → **일** (요청서에 예시로 적힌 `2026-07-26`+`토` 조합은 사실과 다르다 — 테스트 데이터로 쓰지 말 것)
   - `2026-09-01` → 화 (오늘), `2026-09-05` → **토**, `2026-09-12` → 토

3. **`renderCards()` 는 infocard를 `innerHTML` 로 그린다.** 따라서 date/time 표시 함수는 절대 원본 문자열을 그대로 통과시키면 안 된다 — ISO 패턴에 맞지 않는 입력은 빈 문자열을 반환해야 한다 (아래 T-DT-01 참조).

4. **`enterMeeting()` 도 `m_sub` 를 직접 쓴다** (index.html 336행 근처: `` `📍 ${MEETING.place} · ${MEETING.time||''}` ``). `renderCards()` 만 고치면 지도 화면 진입 시 ISO 원본이 노출된다 — 두 곳 모두 고쳐야 한다.

5. **index.html에는 이 작업과 무관한 기존 미커밋 변경 1줄**(`myEtaVal` 근처 dash 문자 정규화)이 있다. 되돌리지 말고 그대로 둔다.
</key_facts>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: 네이티브 피커 + ISO 저장 + 한국어 표시를 end-to-end 한 경로로 관통</name>
  <files>scripts/verify-datetime-picker.mjs, package.json, index.html</files>

  <read_first>
    - `index.html` 155-158행 (`.row2` 안의 `f_date`/`f_time` 입력)
    - `index.html` 245-259행 (`meetingText()`, `renderCards()`, input 리스너 등록)
    - `index.html` 333-341행 (`enterMeeting()` 의 `m_sub` 직접 기록)
    - `scripts/verify-join-secret.mjs` 전체 — `check`/`assertEqual`/`assertTrue`/`waitForServerReady`/`cleanup` 헬퍼와 서버 spawn 패턴을 그대로 재사용한다
  </read_first>

  <behavior>
    새 스크립트가 검증할 기대 동작 (구현 전에 먼저 작성해 RED를 확인한다):
    - A: `index.html` 의 `id="f_date"` 입력이 `type="date"` 속성을, `id="f_time"` 입력이 `type="time"` 과 `step="300"` 속성을 가진다
    - B1: `fmtDateKo('2025-07-26')` → `'7월 26일 (토)'`
    - B2: `fmtDateKo('2026-09-05')` → `'9월 5일 (토)'` (월·일 앞자리 0 없음)
    - B3: `fmtTimeKo('19:00')` → `'오후 7:00'`
    - B4: `fmtTimeKo('09:05')` → `'오전 9:05'`
    - B5: `fmtTimeKo('00:30')` → `'오전 12:30'`
    - B6: `fmtTimeKo('12:00')` → `'오후 12:00'`
    - B7: 형식이 어긋난 입력은 빈 문자열 — `fmtDateKo('7월 26일 (토)')` → `''`, `fmtTimeKo('오후 7:00')` → `''`
    - B8: 꺾쇠 문자가 섞인 입력도 빈 문자열 — `fmtDateKo('2025-07-26<b>')` → `''`
    - C: `index.html` 인라인 script 전체가 `new Function` 으로 SyntaxError 없이 파싱된다
    - D: 실제 서버를 띄워 `POST /api/meetings` 에 `date:'2026-09-05', time:'19:00'` 을 보내고 `GET /api/meetings/:id` 로 되받으면 두 값이 문자 그대로 보존된다 (opaque 계약 유지 증명)
  </behavior>

  <action>
    **1단계 — RED: 검증 스크립트를 먼저 만든다.**

    `scripts/verify-datetime-picker.mjs` 를 새로 만든다. `scripts/verify-join-secret.mjs` 의 구조를 그대로 따른다: shebang, `check()` / `assertEqual()` / `assertTrue()` / `fail()` 헬퍼, 랜덤 PORT + `os.tmpdir()` 임시 DATA_FILE, `spawn('node', ['server.js'])`, `waitForServerReady()`, `process.on('exit'|'SIGINT'|'SIGTERM')` cleanup, 마지막에 `ALL PASS` 출력 후 `process.exit(0)`. 의존성은 Node 빌트인만 쓴다 (`ws` 불필요 — WebSocket 검증 없음).

    브라우저 없이 index.html 안의 순수 함수를 실제로 실행하기 위해, 스크립트는 마커로 구분된 구획을 정규식으로 잘라내 `new Function` 으로 평가한다. 추출 헬퍼를 다음 형태로 작성한다:

    - `index.html` 을 읽어 `DATETIME-HELPERS:START` 와 `DATETIME-HELPERS:END` 두 마커 사이의 소스를 잘라낸다 (마커가 없으면 명확한 실패 메시지와 함께 FAIL)
    - 잘라낸 소스 뒤에 helper 이름들을 담은 객체를 반환하는 return 문을 이어붙여 `new Function(src + returnStmt)()` 로 평가하고, 결과 객체를 각 check에서 호출한다
    - 이 구획의 함수들은 DOM/전역에 접근하지 않는 순수 함수여야만 평가가 성공한다 — 그 제약을 구현 쪽에서 지킨다

    check A, B(위 behavior의 B1~B8 전부 개별 assert), C, D 를 작성한다. C는 `verify-join-secret.mjs` 의 check G와 동일한 방식(첫 `<script>` 블록 정규식 추출 후 `new Function`)을 쓴다. D는 `waitForServerReady()` 뒤에 fetch로 POST/GET 하고 `assertEqual` 로 문자열 동일성을 확인한다.

    `package.json` 의 `scripts` 에 `"verify:datetime-picker": "node scripts/verify-datetime-picker.mjs"` 를 `verify:join-secret` 옆에 추가한다.

    여기서 `npm run verify:datetime-picker` 를 실행해 **실패하는 것을 확인한다** (마커 부재 + 속성 부재로 A/B가 FAIL). 실패를 확인한 뒤 커밋: `test(quick-260901-dww): add datetime picker verification script (RED)`

    **2단계 — GREEN: index.html을 구현한다.**

    (a) 입력 교체 — `.row2` 안의 두 입력을 네이티브 피커로 바꾼다. `f_date` 는 `type="date"`, `f_time` 은 `type="time"` 에 `step="300"`. `class="field"` 와 `id` 는 유지한다. HTML의 `value` 속성에는 ISO 정적 폴백을 둔다 (`2026-09-05` / `19:00` — key_facts 2에서 토요일로 검증된 날짜). 기존 한국어 문자열 value는 제거한다.

    (b) 순수 헬퍼 구획 추가 — `meetingText()` 정의 바로 위에, 검증 스크립트가 잘라낼 수 있도록 시작/끝 마커 주석으로 감싼 구획을 만들고 그 안에 DOM을 전혀 참조하지 않는 순수 함수만 넣는다. 마커 문자열은 위 1단계에서 스크립트가 찾는 것과 정확히 같아야 한다.

    구획에 넣을 함수와 정확한 계약:

    - `isISODate(v)` — `v` 가 문자열이고 `/^\d{4}-\d{2}-\d{2}$/` 에 정확히 맞으면 true. 앵커를 반드시 붙여 뒤에 덧붙은 문자를 거른다.
    - `isISOTime(v)` — `v` 가 문자열이고 `/^\d{2}:\d{2}$/` 에 정확히 맞으면 true.
    - `fmtDateKo(v)` — `isISODate(v)` 가 false면 빈 문자열을 반환한다. true면 `v` 를 `-` 로 쪼개 숫자로 만들고 `new Date(y, m-1, d)` 로 로컬 Date를 구성한 뒤 (`new Date(v)` 는 UTC 파싱이라 시간대에 따라 하루 밀린다 — 쓰지 말 것), 요일 배열 `['일','월','화','수','목','금','토']` 에서 `getDay()` 로 요일을 뽑아 `` `${m}월 ${d}일 (${w})` `` 를 반환한다. 월·일에 앞자리 0을 붙이지 않는다.
    - `fmtTimeKo(v)` — `isISOTime(v)` 가 false면 빈 문자열을 반환한다. true면 시(h)와 분(mi)을 숫자로 만들고, `h < 12` 면 오전 / 아니면 오후를 붙이며, 12시간제 시각은 `h % 12` 가 0이면 12로 대체한다. 분은 2자리로 0을 채운다. 결과는 `` `${ampm} ${h12}:${mm}` `` 형태.

    이 구획 안에서는 `document`, `window`, `MEETING` 등 어떤 외부 식별자도 참조하지 않는다 — 참조하면 검증 스크립트의 `new Function` 평가가 깨진다.

    (c) 표시 배선 — `renderCards()` 가 `m.date` / `m.time` 원본 대신 `fmtDateKo(m.date)` / `fmtTimeKo(m.time)` 결과를 쓰도록 바꾼다. infocard의 날짜 줄, 시간 줄, 그리고 `m_sub` 의 `` `📍 ${m.place} · …` `` 뒤 시간 부분 모두 포맷 함수를 거치게 한다. `meetingText()` 자체는 ISO 원본을 반환하도록 그대로 둔다 — 저장값과 표시값의 분리가 이 작업의 핵심이다.

    (d) `enterMeeting()` 의 `m_sub` 기록도 `fmtTimeKo(MEETING.time)` 를 거치게 바꾼다 (key_facts 4). `MEETING.time` 이 비어 있을 때 빈 문자열이 되는 기존 동작은 유지된다 — `fmtTimeKo` 가 이미 비ISO 입력에 빈 문자열을 돌려준다.

    `npm run verify:datetime-picker` 로 A/B/C/D 전부 PASS를 확인한 뒤 커밋: `feat(quick-260901-dww): switch date/time inputs to native pickers with ISO storage`
  </action>

  <verify>
    <automated>npm run verify:datetime-picker</automated>
  </verify>

  <done>
    `npm run verify:datetime-picker` 가 check A, B1~B8, C, D 를 모두 PASS로 출력한다. `git diff --stat server.js` 가 빈 출력이다 (server.js 무수정).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: 모바일 1분 휠을 5분 단위로 강제하는 JS 보정</name>
  <files>scripts/verify-datetime-picker.mjs, index.html</files>

  <read_first>
    - Task 1에서 만든 `scripts/verify-datetime-picker.mjs` 의 구획 추출 헬퍼
    - Task 1에서 index.html에 추가한 순수 헬퍼 구획
  </read_first>

  <behavior>
    - E1: `roundTimeTo5('07:03')` → `'07:05'`
    - E2: `roundTimeTo5('07:02')` → `'07:00'`
    - E3: `roundTimeTo5('07:07')` → `'07:05'`
    - E4: `roundTimeTo5('07:08')` → `'07:10'`
    - E5: `roundTimeTo5('19:00')` → `'19:00'` (이미 5분 단위면 그대로)
    - E6: `roundTimeTo5('23:58')` → `'23:55'` (하루를 넘기지 않도록 상한에서 잘림 — 날짜 필드가 따로 있으므로 날짜가 밀리면 안 된다)
    - E7: `roundTimeTo5('00:02')` → `'00:00'`
    - E8: `roundTimeTo5('09:30:00')` → `'09:30'` (초가 붙어 들어와도 처리)
    - E9: `roundTimeTo5('')` → `''`, `roundTimeTo5('오후 7시')` → `''`
    - F: `index.html` 이 `f_time` 에 `change` 리스너를 등록하고 그 안에서 `roundTimeTo5` 를 호출한다 (소스 문자열 검사)
  </behavior>

  <action>
    **1단계 — RED: 검증을 먼저 늘린다.**

    `scripts/verify-datetime-picker.mjs` 에 check E (위 E1~E9 각각 개별 assert)와 check F를 추가한다. E는 Task 1의 구획 추출 헬퍼로 얻은 객체에서 `roundTimeTo5` 를 꺼내 호출한다 — 추출 대상 이름 목록에 `roundTimeTo5` 를 더한다. F는 `index.html` 소스에서 `f_time` 리스너 등록 부분과 `roundTimeTo5` 호출이 함께 존재하는지 확인한다.

    실행해 E/F가 FAIL하는 것을 확인한 뒤 커밋: `test(quick-260901-dww): add 5-minute rounding checks (RED)`

    **2단계 — GREEN: 보정 로직을 구현한다.**

    (a) 순수 함수 — Task 1이 만든 헬퍼 구획 안에 `roundTimeTo5(v)` 를 추가한다. 계약:
    - `v` 가 `/^(\d{2}):(\d{2})(:\d{2})?$/` 에 맞지 않으면 빈 문자열 반환 (초 부분은 있으면 버린다)
    - 총 분 `total = h*60 + mi` 를 계산하고 `Math.round(total / 5) * 5` 로 가장 가까운 5분 단위를 구한다. `Math.round` 는 .5를 올림하므로 분의 나머지가 2면 내려가고 3이면 올라간다 — E1/E2가 요구하는 정책과 일치한다.
    - 결과를 `0` 이상 `1435` 이하로 자른다. 1435는 23:55이며, 23:58이 1440(다음 날 00:00)으로 넘어가 날짜가 밀리는 것을 막는 상한이다.
    - 자른 값을 다시 시/분으로 나눠 각각 2자리로 0을 채운 `HH:MM` 문자열로 반환한다.

    이 함수도 구획 안에 있으므로 DOM/전역을 참조하지 않는다.

    (b) 이벤트 배선 — `f_time` 에 `change` 리스너를 등록해, 현재 `.value` 를 `roundTimeTo5` 에 통과시킨 결과가 현재 값과 다르면 `.value` 에 다시 써넣는다. 보정으로 값이 바뀌었을 때는 `renderCards()` 를 호출해 카드 표시도 함께 갱신한다 (프로그램적 `.value` 대입은 `input` 이벤트를 발생시키지 않으므로 기존 `input` 리스너에만 의존하면 카드가 옛 값에 머문다).

    `step="300"` 은 HTML5 유효성 검증에만 영향을 주고 모바일 OS의 시간 휠은 여전히 1분 단위로 돌기 때문에, 실제 5분 단위 강제는 이 JS 보정이 담당한다. 속성과 JS 보정 두 가지를 모두 유지한다.

    `npm run verify:datetime-picker` 로 A~F 전부 PASS를 확인한 뒤 커밋: `feat(quick-260901-dww): snap time picker input to 5-minute increments`
  </action>

  <verify>
    <automated>npm run verify:datetime-picker</automated>
  </verify>

  <done>
    check E1~E9 와 F 가 PASS한다. 이전 check A~D 도 계속 PASS한다.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: 초대 링크 round-trip ISO 재적용 가드 + 기본 날짜</name>
  <files>scripts/verify-datetime-picker.mjs, index.html</files>

  <read_first>
    - `index.html` 288-296행 (`gotoJoin()` — 서버 응답을 입력에 재대입하는 지점)
    - Task 1/2에서 확장한 `scripts/verify-datetime-picker.mjs`
  </read_first>

  <behavior>
    - G1: `nextSaturdayISO(new Date(2026, 8, 1))` → `'2026-09-05'` (화요일 → 다가오는 토요일)
    - G2: `nextSaturdayISO(new Date(2026, 8, 5))` → `'2026-09-05'` (당일이 토요일이면 당일)
    - G3: `nextSaturdayISO(new Date(2026, 8, 6))` → `'2026-09-12'` (일요일 → 다음 토요일)
    - H: `index.html` 의 `gotoJoin` 이 서버 응답을 입력에 직접 대입하지 않고 `applyISODateTime` 을 거친다 (소스 문자열 검사)
    - I: 서버 round-trip 후 재적용 경로가 형식 가드를 통과한다 — 실제 서버에 ISO 값을 POST/GET한 뒤, 되받은 값이 `isISODate`/`isISOTime` 를 각각 통과하고 `fmtDateKo`/`fmtTimeKo` 로 `'9월 5일 (토)'` / `'오후 7:00'` 을 만들어낸다 (Task 1의 check D를 확장하거나 그 뒤에 이어 붙인다)
  </behavior>

  <action>
    **1단계 — RED: 검증을 먼저 늘린다.**

    `scripts/verify-datetime-picker.mjs` 에 check G (G1~G3), H, I를 추가한다. 구획 추출 대상 이름 목록에 `nextSaturdayISO` 를 더한다. I는 이미 서버를 띄워두었으므로 check D의 응답 값을 재사용해 포맷 함수까지 통과시키면 된다.

    실행해 G/H/I가 FAIL하는 것을 확인한 뒤 커밋: `test(quick-260901-dww): add ISO round-trip guard checks (RED)`

    **2단계 — GREEN: 구현한다.**

    (a) 순수 함수 — 헬퍼 구획에 `nextSaturdayISO(base)` 를 추가한다. `base` Date로부터 `(6 - base.getDay() + 7) % 7` 일을 더한 로컬 Date를 만들고 `YYYY-MM-DD` 문자열로 반환한다 (연/월/일을 각각 `getFullYear`/`getMonth`+1/`getDate` 로 뽑아 2자리 패딩; `toISOString()` 은 UTC 변환이라 시간대에 따라 하루 밀리므로 쓰지 말 것). base가 토요일이면 나머지가 0이 되어 당일을 그대로 돌려준다.

    (b) 기본값 — 초기 로드 시 `f_date.value` 를 `nextSaturdayISO(new Date())` 로 설정한다. `f_time` 은 HTML의 `19:00` 을 그대로 쓴다. 이 설정은 기존 `renderCards()` 최초 호출보다 먼저 일어나야 카드에 올바른 날짜가 그려진다. HTML의 정적 `value` 는 폴백으로 남겨둔다.

    (c) round-trip 가드 — `applyISODateTime(dateVal, timeVal)` 를 추가한다 (DOM을 만지므로 헬퍼 구획 **바깥**에 둔다). `isISODate(dateVal)` 가 true일 때만 `f_date.value` 에 대입하고, `isISOTime(timeVal)` 가 true일 때만 `f_time.value` 에 대입한다. 형식이 맞지 않으면 해당 입력은 현재 값을 유지한다.

    `gotoJoin()` 에서 `f_date`/`f_time` 에 직접 대입하던 두 줄을 `applyISODateTime(info.date, info.time)` 호출로 교체한다. `f_name`/`f_place` 대입은 그대로 둔다. `MEETING` 객체에는 기존처럼 서버가 준 값을 담는다.

    이 가드가 필요한 이유: 네이티브 입력에 형식이 어긋난 문자열을 대입하면 브라우저가 조용히 `.value` 를 비워버려 참여자 화면의 날짜/시간이 사라진다. 또한 이 가드와 Task 1의 포맷 함수 빈문자열 반환이 함께, 서버에 저장된 임의 문자열이 `renderCards()` 의 innerHTML까지 도달하는 경로를 막는다 (T-DT-01).

    `npm run verify:datetime-picker` 와 `npm run verify:join-secret` 을 모두 실행해 회귀가 없는지 확인한 뒤 커밋: `feat(quick-260901-dww): guard ISO round-trip on invite join`
  </action>

  <verify>
    <automated>npm run verify:datetime-picker && npm run verify:join-secret</automated>
    <human-check>
      `npm start` 후 모바일 브라우저(또는 데스크톱 브라우저의 모바일 에뮬레이션)에서 열어 확인:
      1. 모임 만들기 화면의 날짜 칸을 누르면 네이티브 달력이, 시간 칸을 누르면 네이티브 시간 피커가 열린다 (키보드 타이핑 불가)
      2. 시간 휠을 07:03 같은 비-5분 시각에 맞추고 확정하면 값이 07:05로 스냅되고 아래 카드의 시간 표시도 함께 바뀐다
      3. 카드와 지도 상단 서브타이틀에 `9월 5일 (토)` / `오후 7:00` 형태의 한국어 표시가 보인다 (ISO 원본 노출 없음)
      4. 모임 만들기 → 초대 링크 복사 → "새 탭에서 참여자로 열기" 로 참여 화면에 들어갔을 때 날짜/시간이 비지 않고 동일하게 보인다
    </human-check>
  </verify>

  <done>
    `npm run verify:datetime-picker` 가 `ALL PASS` 를 출력하고 `npm run verify:join-secret` 도 회귀 없이 통과한다. `git diff --stat server.js` 가 빈 출력이다.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| 브라우저 폼 → `POST /api/meetings` | 사용자가 통제하는 date/time 문자열이 서버 저장소로 넘어간다. 서버는 검증 없이 그대로 저장한다. |
| `GET /api/meetings/:id` → 참여자 브라우저 | 모임 생성자가 넣은 문자열이 **다른 사람**의 DOM으로 흘러 들어간다. `renderCards()` 가 `innerHTML` 로 그리므로 신뢰 경계다. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-DT-01 | Tampering / XSS | `renderCards()` 의 infocard `innerHTML` 에 흘러드는 `date`/`time` | high | mitigate | Task 1의 `fmtDateKo`/`fmtTimeKo` 가 ISO 정규식(앵커 포함) 불일치 시 빈 문자열을 반환하고, Task 3의 `applyISODateTime` 가 형식 불일치 값의 입력 대입 자체를 차단한다. 결과적으로 innerHTML에 삽입되는 date/time 문자열은 포맷 함수가 자체 생성한 숫자·한글 조합으로만 한정된다. check B7/B8이 이를 회귀 검증한다. |
| T-DT-02 | Tampering | 클라이언트 우회 (`fetch` 직접 호출)로 임의 date/time 문자열 POST | medium | accept | 피커는 클라이언트 UX 제약이며 서버 측 검증이 아니다. server.js 무수정이 이 작업의 명시적 제약(요구사항 6)이므로 서버 검증은 범위 밖. T-DT-01의 출력 측 가드가 소비 지점에서 방어하므로 잔여 위험은 저장소 오염(형식이 깨진 값이 참여자 화면에서 빈칸으로 보임)에 한정된다. |
| T-DT-03 | Tampering / XSS | `renderCards()` 의 `m.name` / `m.place` innerHTML 보간 | high | accept | **기존 취약점이며 이 작업이 새로 만들거나 넓히지 않는다.** date/time과 동일한 저장형 XSS 경로가 name/place에 남아 있다. 이 quick task 범위(날짜/시간 입력 방식 변경) 밖이므로 손대지 않고, 후속 작업 항목으로 STATE.md Pending Todos에 기록한다. |
| T-DT-SC | Tampering | npm/pip/cargo installs | n/a | mitigate | 신규 패키지 설치 없음 — 검증 스크립트는 Node 빌트인만 사용하고 `package.json` 변경은 `scripts` 항목 1줄 추가뿐이다. 공급망 표면 증가 없음. |
</threat_model>

<verification>
1. `npm run verify:datetime-picker` → `ALL PASS`
2. `npm run verify:join-secret` → `ALL PASS` (기존 회귀 없음)
3. `git diff --stat server.js` → 빈 출력 (opaque 문자열 계약 유지)
4. `grep -c 'type="date"' index.html` → 1 이상, `grep -c 'step="300"' index.html` → 1 이상
5. Task 3의 `<human-check>` 4항목 — 실기기/모바일 에뮬레이션에서 육안 확인
</verification>

<success_criteria>
- `f_date` 가 `<input type="date">`, `f_time` 이 `<input type="time" step="300">` 이다
- 시간 피커에서 비-5분 시각을 고르면 JS가 가장 가까운 5분 단위로 스냅하고, 23:58은 23:55로 잘려 날짜가 밀리지 않는다
- 서버로 오가는 값은 항상 `YYYY-MM-DD` / `HH:MM` 이고, 화면 표시는 `7월 26일 (토)` / `오후 7:00` 형태의 한국어다
- 초대 링크로 들어온 참여자 화면에서 날짜/시간이 비지 않고 동일하게 표시된다
- server.js 무수정, 신규 npm 의존성 0
- `scripts/verify-datetime-picker.mjs` 가 check A~I 전부를 자동으로 검증한다
</success_criteria>

<output>
Create `.planning/quick/260901-dww-index-html-5-date-time/260901-dww-SUMMARY.md` when done
</output>
