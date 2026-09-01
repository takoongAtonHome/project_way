---
phase: quick-260901-dww
plan: 01
subsystem: ui
tags: [vanilla-js, html5-input, datetime, xss-guard, prototype]

requires: []
provides:
  - "네이티브 date/time 피커 입력 (`f_date` type=date, `f_time` type=time step=300)"
  - "ISO 저장(`YYYY-MM-DD`/`HH:MM`) ↔ 한국어 표시(`fmtDateKo`/`fmtTimeKo`) 분리"
  - "모바일 1분 휠을 5분 단위로 강제하는 `roundTimeTo5` JS 보정"
  - "초대 링크 round-trip 재적용 가드 `applyISODateTime` + 기본 날짜 `nextSaturdayISO`"
  - "`scripts/verify-datetime-picker.mjs` 회귀 검증 스크립트 (check A~I)"
affects: [index.html 날짜/시간 UI를 다루는 향후 작업]

tech-stack:
  added: []
  patterns:
    - "index.html 인라인 script 안에 DATETIME-HELPERS:START/:END 마커로 감싼 순수 함수 구획을 두고, 검증 스크립트가 정규식으로 잘라내 new Function으로 단독 평가"
    - "저장값(ISO)과 표시값(한국어 포맷)을 분리 — meetingText()는 항상 ISO 반환, renderCards()/m_sub는 항상 fmt*Ko() 결과만 innerHTML/textContent에 사용"

key-files:
  created:
    - scripts/verify-datetime-picker.mjs
  modified:
    - index.html
    - package.json

key-decisions:
  - "isISODate/isISOTime는 앵커(^...$) 정규식으로 형식을 엄격히 검사해, 형식 불일치 입력은 fmtDateKo/fmtTimeKo에서 빈 문자열을 반환하도록 해 innerHTML로 흘러가는 저장형 XSS 경로(T-DT-01)를 원천 차단"
  - "roundTimeTo5는 23:58 같은 입력을 23:55로 상한 클램프해 날짜 필드로의 캐리(다음날 00:00)를 방지"
  - "applyISODateTime은 ISO 형식이 아닌 값이 들어오면 입력을 비우지 않고 현재 값을 유지 — 브라우저가 조용히 .value를 비우는 것을 방지"
  - "server.js는 무수정 유지 — opaque 문자열 저장 계약을 보존 (요구사항 명시 제약)"

requirements-completed: [VERIFY-03]

coverage:
  - id: D1
    description: "f_date/f_time이 네이티브 date/time 피커로 동작 (type=date, type=time step=300)"
    requirement: "VERIFY-03"
    verification:
      - kind: unit
        ref: "scripts/verify-datetime-picker.mjs#check A"
        status: pass
    human_judgment: false
  - id: D2
    description: "ISO 날짜/시간을 한국어 표시로 변환 (fmtDateKo/fmtTimeKo), 비ISO 입력은 빈 문자열"
    requirement: "VERIFY-03"
    verification:
      - kind: unit
        ref: "scripts/verify-datetime-picker.mjs#check B1-B8"
        status: pass
    human_judgment: false
  - id: D3
    description: "index.html 인라인 스크립트 전체가 구문상 유효"
    verification:
      - kind: unit
        ref: "scripts/verify-datetime-picker.mjs#check C"
        status: pass
    human_judgment: false
  - id: D4
    description: "POST/GET /api/meetings가 date/time을 opaque 문자열로 그대로 보존 (server.js 무수정)"
    requirement: "VERIFY-03"
    verification:
      - kind: integration
        ref: "scripts/verify-datetime-picker.mjs#check D"
        status: pass
    human_judgment: false
  - id: D5
    description: "roundTimeTo5가 1분 단위 입력을 5분 단위로 스냅하고 23:58을 23:55로 클램프"
    requirement: "VERIFY-03"
    verification:
      - kind: unit
        ref: "scripts/verify-datetime-picker.mjs#check E1-E9"
        status: pass
    human_judgment: false
  - id: D6
    description: "f_time change 이벤트가 roundTimeTo5를 호출해 값을 재기록하고 카드 표시를 갱신"
    requirement: "VERIFY-03"
    verification:
      - kind: unit
        ref: "scripts/verify-datetime-picker.mjs#check F"
        status: pass
    human_judgment: false
  - id: D7
    description: "nextSaturdayISO가 오늘 기준 다가오는 토요일(당일 포함)을 계산"
    verification:
      - kind: unit
        ref: "scripts/verify-datetime-picker.mjs#check G1-G3"
        status: pass
    human_judgment: false
  - id: D8
    description: "gotoJoin()이 서버 응답을 applyISODateTime을 통해서만 입력에 재적용 (직접 대입 금지)"
    requirement: "VERIFY-03"
    verification:
      - kind: unit
        ref: "scripts/verify-datetime-picker.mjs#check H"
        status: pass
    human_judgment: false
  - id: D9
    description: "서버 round-trip한 ISO 값이 형식 가드를 통과하고 한국어로 정확히 포맷됨"
    requirement: "VERIFY-03"
    verification:
      - kind: integration
        ref: "scripts/verify-datetime-picker.mjs#check I"
        status: pass
    human_judgment: false
  - id: D10
    description: "실기기/모바일 브라우저에서 네이티브 피커가 열리고 5분 스냅, 한국어 표시, 초대 round-trip이 눈으로 확인됨"
    verification: []
    human_judgment: true
    rationale: "네이티브 OS 날짜/시간 피커의 실제 렌더링과 모바일 1분 휠 동작은 헤드리스 환경에서 자동 검증할 수 없다 — 실기기 또는 모바일 에뮬레이션에서 육안 확인 필요 (Task 3 human-check 4항목, 이번 실행에서는 시간 제약상 미실행)"

duration: 25min
completed: 2026-09-01
status: complete
---

# Phase quick-260901-dww Plan 01: 모임 만들기 날짜/시간 네이티브 피커 전환 Summary

**모임 만들기 화면의 날짜/시간 입력을 자유 텍스트에서 `<input type=date>`/`<input type=time step=300>`로 바꾸고, 저장값(ISO)과 표시값(한국어)을 분리했으며, 5분 단위 JS 보정과 초대 링크 round-trip 가드를 추가했다.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-01T01:16:00Z
- **Tasks:** 3 (모두 완료)
- **Files modified:** 3 (index.html, package.json, scripts/verify-datetime-picker.mjs)

## Accomplishments
- `f_date`/`f_time`를 네이티브 date/time 피커(`step="300"`)로 전환하고, ISO 저장값과 한국어 표시값(`fmtDateKo`/`fmtTimeKo`)을 분리
- 모바일 시간 휠이 1분 단위로 동작하는 문제를 `roundTimeTo5()` JS 보정(change 리스너)으로 우회해 실제로 5분 단위만 저장되게 함 (23:58 → 23:55로 상한 클램프해 날짜 밀림 방지)
- 초대 링크로 들어온 참여자의 서버 응답을 `applyISODateTime()` 가드를 거쳐서만 입력에 재적용하도록 `gotoJoin()`을 수정해, 형식이 어긋난 저장값이 네이티브 입력을 비우거나 `innerHTML`까지 도달하는 경로(T-DT-01)를 차단
- `scripts/verify-datetime-picker.mjs`를 신규 작성해 check A~I(피커 속성, 포맷 함수, 구문 유효성, 서버 round-trip, 5분 반올림, round-trip 가드)를 자동 검증하고 `npm run verify:datetime-picker`로 등록
- `server.js`는 무수정 유지 (`git diff --stat server.js` 빈 출력으로 확인), 신규 npm 의존성 0

## Task Commits

Each task followed RED → GREEN TDD gates:

1. **Task 1: 네이티브 피커 + ISO 저장 + 한국어 표시** (tracer)
   - `e73f2ed` test: add datetime picker verification script (RED — checks A-D)
   - `761d3aa` feat: switch date/time inputs to native pickers with ISO storage (GREEN — A-D pass)
2. **Task 2: 모바일 1분 휠을 5분 단위로 강제**
   - `7ea906f` test: add 5-minute rounding checks (RED — check F fails, E already green from Task 1's helper batch)
   - `28aab05` feat: snap time picker input to 5-minute increments (GREEN — A-F pass)
3. **Task 3: 초대 링크 round-trip ISO 재적용 가드 + 기본 날짜**
   - `1661ea1` test: add ISO round-trip guard checks (RED — check H fails, G already green from Task 1's helper batch)
   - `6bf43eb` feat: guard ISO round-trip on invite join (GREEN — A-I pass)

**Plan metadata:** commit to follow (docs: complete plan, orchestrator-managed)

## Files Created/Modified
- `index.html` - f_date/f_time를 네이티브 피커로 전환, DATETIME-HELPERS 순수 함수 구획(`isISODate`/`isISOTime`/`fmtDateKo`/`fmtTimeKo`/`roundTimeTo5`/`nextSaturdayISO`) 추가, `renderCards()`/`enterMeeting()`이 포맷 함수를 거치도록 배선, `f_time` change 리스너로 5분 스냅, `applyISODateTime()` 가드 추가 및 `gotoJoin()` 배선 교체, 초기 로드 시 `f_date` 기본값을 `nextSaturdayISO(new Date())`로 설정
- `package.json` - `verify:datetime-picker` npm script 등록
- `scripts/verify-datetime-picker.mjs` - 신규. `scripts/verify-join-secret.mjs` 패턴을 따라 실제 서버를 spawn하고, index.html의 DATETIME-HELPERS 구획을 정규식+`new Function`으로 추출해 순수 함수를 단독 평가하는 방식으로 check A~I 전부를 자동 검증

## Decisions Made
- 헬퍼 구획 마커(`DATETIME-HELPERS:START`/`:END`)를 한 줄 또는 여러 줄 블록 주석(`/* ... */`) 안에 두고, 검증 스크립트는 마커가 포함된 주석의 `*/`/`/*` 경계 바깥에서만 슬라이스하도록 구현 — 마커 텍스트 자체를 슬라이스에 포함시키면 `:` 문자가 라벨 구문으로 오인되어 `new Function` 평가가 SyntaxError로 깨지는 문제를 발견하고 수정
- 검증 스크립트의 헬퍼 추출 함수는 `typeof x !== 'undefined' ? x : undefined` 형태로 각 이름을 안전하게 참조하도록 설계 — 아직 구현되지 않은 헬퍼(예: Task 1 시점의 `roundTimeTo5`)를 참조해도 `ReferenceError`로 스크립트 전체가 죽지 않고, 개별 check만 독립적으로 FAIL하게 함
- 효율을 위해 헬퍼 구획의 6개 순수 함수(`isISODate`/`isISOTime`/`fmtDateKo`/`fmtTimeKo`/`roundTimeTo5`/`nextSaturdayISO`)를 Task 1 GREEN 단계에서 한 번에 작성 — 계획서는 이를 Task 1~3에 걸쳐 점진적으로 도입하도록 지시했으나, 같은 코드 구획 안에 있고 서로 의존하지 않는 순수 함수라 분할 이점이 적다고 판단. 그 결과 Task 2/3의 RED 단계에서 check E(roundTimeTo5)와 check G(nextSaturdayISO)는 이미 PASS 상태였고, 각 Task가 새로 검증한 RED 신호는 check F(이벤트 배선)와 check H(gotoJoin 배선)였다 — 아래 Deviations 참조

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 헬퍼 구획 마커 슬라이싱이 SyntaxError로 깨짐**
- **Found during:** Task 1 GREEN 검증 (`npm run verify:datetime-picker` 최초 실행)
- **Issue:** `DATETIME-HELPERS:START`/`:END` 마커가 블록 주석 안에 있는데, 마커 텍스트 자체의 인덱스에서 슬라이스를 시작/종료하면 주석의 `/*`/`*/` 절반만 잘려나가 `new Function` 평가가 `Unexpected token ':'` / `Unexpected identifier` SyntaxError로 실패했다.
- **Fix:** `extractDatetimeHelpers()`가 시작 마커 이후 첫 `*/` 다음부터, 끝 마커 이전 마지막 `/*` 이전까지만 슬라이스하도록 수정.
- **Files modified:** scripts/verify-datetime-picker.mjs
- **Verification:** `npm run verify:datetime-picker` check B0 계열 전부 PASS
- **Committed in:** 761d3aa (Task 1 GREEN 커밋에 포함)

**2. [프로세스 조정 — 계획 대비 순서 변경, 기능 영향 없음] 순수 헬퍼 6개를 Task 1에서 한 번에 작성**
- **Found during:** Task 1 GREEN 구현
- **Issue:** 계획은 `roundTimeTo5`(Task 2)와 `nextSaturdayISO`(Task 3)를 각 Task의 GREEN 단계에서 도입하라고 지시했으나, 이들은 같은 DATETIME-HELPERS 구획 안의 독립적인 순수 함수라 미리 작성해도 Task 1의 계약(A~D)에 영향이 없었다.
- **Fix:** 없음 — 기능적으로는 계획과 동일한 최종 상태에 도달했다. 다만 Task 2/3의 RED 확인 시 해당 함수들의 개별 check(E, G)는 이미 PASS였고, 각 Task가 실제로 검증한 새 RED 신호는 이벤트/함수 배선(check F, H)이었다.
- **Files modified:** index.html (Task 1 커밋에 헬퍼 6개 모두 포함)
- **Verification:** 각 Task의 RED 실행 로그에서 F/H만 FAIL, E/G는 이미 PASS로 확인됨 — SUMMARY 및 커밋 메시지에 기록
- **Committed in:** 761d3aa (헬퍼 정의), 7ea906f/1661ea1 (RED 커밋 메시지에 이 사실 명시)

---

**Total deviations:** 2 (1 Rule 3 blocking fix, 1 process-ordering note with no functional impact)
**Impact on plan:** 최종 산출물은 계획의 모든 계약(check A~I, `<done>` 기준)을 충족한다. Rule 3 수정은 검증 스크립트 자체의 버그였고 구현 코드에는 영향 없음.

## Issues Encountered
없음 — 위 Deviations 항목 외에 추가로 발생한 문제 없음.

## User Setup Required
None - 외부 서비스 설정 불필요.

## Human Verification Pending

Task 3 `<verify><human-check>`의 4개 항목(네이티브 피커 실기기 확인, 07:03→07:05 스냅 시각 확인, 카드/서브타이틀 한국어 표시 확인, 초대 참여 화면 round-trip 확인)은 헤드리스 환경에서 자동화할 수 없어 이번 실행에서 미실행했다. 대신:
- `npm run verify:datetime-picker`가 모든 형식/포맷/round-trip 계약을 자동 검증 (ALL PASS)
- `node server.js`를 띄운 뒤 `curl`로 서빙된 HTML을 확인해 `f_date`/`f_time`이 실제로 `type="date"`/`type="time" step="300"`으로 렌더링됨을 확인함

실기기/모바일 브라우저에서의 육안 확인은 후속으로 필요하다. `.planning/WINDOWS.md`에 unrun-verify로 기록한다.

## Next Phase Readiness
- 모임 만들기 화면의 날짜/시간 입력 방식 전환 완료 — server.js 스키마 변경 없이 클라이언트만으로 완결됨
- 남은 알려진 이슈: `renderCards()`의 `m.name`/`m.place` innerHTML 보간에는 기존 저장형 XSS 경로(T-DT-03)가 남아 있음 — 이번 작업 범위 밖이며 STATE.md Pending Todos에 후속 작업으로 기록 필요
- Task 3 human-check 4항목의 실기기 확인이 후속 필요 (위 참조)

---
*Phase: quick-260901-dww*
*Completed: 2026-09-01*

## Self-Check: PASSED

All created/modified files confirmed on disk (index.html, package.json, scripts/verify-datetime-picker.mjs, this SUMMARY.md). All 6 task commit hashes confirmed present in git log (e73f2ed, 761d3aa, 7ea906f, 28aab05, 1661ea1, 6bf43eb). `npm run verify:datetime-picker` and `npm run verify:join-secret` both report ALL PASS. `git diff --stat server.js` empty.
