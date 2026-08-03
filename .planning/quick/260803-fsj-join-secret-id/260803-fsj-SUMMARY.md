---
phase: quick-260803-fsj
status: complete
---

# Quick Task 260803-fsj: 모임 join 보안 강화 — Summary

## What shipped

초대 링크에 별도의 긴 무작위 secret 토큰을 심어, 6자리 모임 ID(`36^6`) 무작위 대입만으로 남의 모임에 들어가 실시간 위치를 볼 수 있던 취약점을 막았다. 사용자가 겪는 흐름(링크 클릭 → 닉네임 입력 → 참여)은 그대로 유지된다.

- `server.js` — `crypto.randomBytes(24).toString('base64url')`로 32자 URL-safe secret을 모임마다 생성해 저장. `GET /api/meetings/:id`는 필드 화이트리스트로 secret을 노출하지 않음. WebSocket `join` 처리 시 `crypto.timingSafeEqual` 기반 상수시간 비교로 secret을 검증하고, 불일치 시 `ws.meetingId`/`ws.p`/`m.room`에 손대기 전에 거부(fail-closed) — 소켓이 이후 `loc`을 보내도 `state` 브로드캐스트를 받을 수 없다. 기존 `data.json`의 secret 없는 모임 4건은 서버 기동 시 자동 backfill됨. 동일 IP의 반복적인 join 실패(60초 내 20회)를 감지해 이후 join 시도를 일시 차단하는 rate limiting도 추가.
- `index.html` — 초대 링크가 `?m=<id>&k=<secret>` 형태로 생성되고, 딥링크 진입/코드 붙여넣기 모두 `k`를 읽어 `MEETING.secret`에 보관, WebSocket join 페이로드에 실어 보낸다. `<meta name="referrer" content="strict-origin-when-cross-origin">`을 추가해 외부 리소스(카카오 SDK 등) 로드 시 Referer로 `k`가 새어나가지 않도록 함.
- `scripts/verify-join-secret.mjs` + `package.json`의 `verify:join-secret` — 실제 서버를 기동해 전체 플로우(A~H)를 검증하는 회귀 스크립트.

## Verification

```
npm run verify:join-secret                 → ALL PASS (A–G, H는 CHECK_RATE_LIMIT=1일 때만 실행)
CHECK_RATE_LIMIT=1 npm run verify:join-secret → ALL PASS (A–H 전부)
```

수동 확인: `node server.js` 기동 → 기존 `data.json` 4건 모임이 에러 없이 로드되고 secret이 backfill됨 → `http://localhost:8000/` HTTP 200.

## Commits

- `37451a9` test(quick-260803-fsj): add join-secret verification script (RED)
- `e3b1a2a` feat(quick-260803-fsj): gate join with invite-link secret token
- `0c88ddd` feat(quick-260803-fsj): rate-limit repeated join failures per IP

## Known follow-ups (not blocking, logged for later)

- **T-QS-02**: `GET /api/meetings/:id`는 `k` 없이도 조회 가능 — 모임 존재 여부(이름/장소/날짜)는 ID만 알아도 열람 가능한 상태로 남아있음(실시간 위치 자체는 노출 안 됨). 코드만 붙여넣는 기존 UX를 보존하기 위한 의도적 트레이드오프.
- rate limit 카운터는 프로세스 메모리에 있어 서버 재시작 시 초기화됨 — 단일 프로세스 MVP 스코프에서는 수용 가능.

## Executor note

이 SUMMARY는 executor 서브에이전트가 세션 한도(API 세션 리밋)로 마지막 sanity-check 단계에서 조기 종료된 후 오케스트레이터가 직접 작성했다. 3개 태스크 커밋은 모두 정상 완료되었고, 검증 스크립트(A–H)와 수동 서버 기동 확인을 오케스트레이터가 재실행해 정상 동작을 재확인했다.
