# 어디쯤

## What This Is

모임(장소·날짜·시간)을 만들고 초대 링크를 공유하면, 당일 참석자들이 설치·가입 없이 닉네임만으로 참여해 지도 위에서 서로의 실시간 위치와 도착 예정 시간(ETA)을 함께 보는 모바일 웹 서비스. 20~30대 친구 모임을 1차 타깃으로 한다.

## Core Value

먼저 도착한 사람이 "늦는 사람이 얼마나 남았는지"를 바로 알아 대기할지 이동할지 스스로 판단할 수 있게 하는 것 — 정확한 위치보다 신뢰할 수 있는 ETA가 핵심이다.

## Requirements

### Validated

- ✓ 모임 생성(장소·날짜·시간) + 초대 링크(`?m=<id>`)로 설치·가입 없이 닉네임만으로 참여 — 로컬 프로토타입 검증
- ✓ "출발" 버튼을 눌러야 위치 공유 시작 (상시 공유 아님) — 로컬 검증
- ✓ 카카오맵 + 기기 GPS로 실제 지도에 실시간 위치 렌더링 — 실물 슬라이스 검증 완료(2026-07-20)
- ✓ Node+Express+ws 백엔드로 모임별 실시간 위치 릴레이(2개 이상 클라이언트) — 검증 완료(2026-07-20)
- ✓ 목적지까지 거리 기반 ETA 계산, 도착 반경(80m) 진입 시 개인 위치 공유 자동 종료 → "도착 인원" 명단 표시 — 검증 완료
- ✓ 모임 데이터 영속화(data.json, 서버 재시작 후에도 유지) — 검증 완료(2026-07-20)
- ✓ 배포 파일 준비(Dockerfile, render.yaml, DEPLOY.md) + 로컬 git 커밋(main) — 완료(2026-07-20)

### Active

- [ ] GitHub 원격 저장소 연결 및 push
- [ ] Render(또는 동등한 호스트)에 HTTPS로 배포
- [ ] 배포 URL을 카카오 디벨로퍼스 플랫폼(Web 도메인)에 등록해 지도 정상 동작 확인
- [ ] 실제 휴대폰 2대 이상으로 같은 모임에 참여해 실시간 위치 공유·ETA·도착 처리가 배포 환경에서 정상 동작하는지 검증

### Out of Scope

- 채팅, 참석투표(RSVP), 장소추천, 정산, 리마인더 알림 — 약속 관리는 위치 공유를 켜기 위한 최소 기능만 유지하고 차별점(당일 ETA 경험)에 집중하기 위해 기획 단계에서 의도적으로 제외
- 백그라운드(앱 종료 시) 위치 추적, 푸시 알림 — 모바일 웹(PWA) MVP의 기술적 한계. 필요 시 네이티브 앱 단계에서 재검토
- PWA 전환(manifest·서비스워커·홈화면 설치) — 배포·실기기 검증(이번 v1) 이후의 다음 마일스톤으로 연기
- 외부 DB 전환(Postgres 등) — Render 무료 플랜의 data.json 초기화 문제 해결용이나, 배포·실기기 검증 이후로 연기
- 정식 서비스명·아이콘·비주얼 디자인 확정 — 가칭 "어디쯤" 유지, 기능 검증 이후로 연기
- 카카오모빌리티 길찾기 API 기반 정확한 경로 ETA — 코드상 연동 준비는 되어 있으나(`KAKAO_REST_KEY`), 활성화·검증은 이번 v1 범위 밖

## Context

- 기획 문서: [기획서.md](../기획서.md) — 문제 정의, 타깃, MVP 범위, 프라이버시 방침의 원본
- 인수인계 문서: [작업기록.md](../작업기록.md) — 지금까지의 진행 이력, 파일 구조, 기술 구조, 알려진 한계를 상세히 기록
- 현재 코드베이스: 단일 `index.html`(프론트, 화면 라우팅 + 카카오맵 + GPS + WS 클라이언트) + `server.js`(백엔드, REST + WebSocket 위치 릴레이 + 도착 판정)
- 카카오 설정: JavaScript 키는 `index.html`의 `CONFIG.KAKAO_JS_KEY`에 이미 등록되어 있고, 현재 등록 도메인은 `http://localhost:8000`뿐이다. 배포 시 배포 URL을 카카오 플랫폼에 추가 등록해야 지도가 뜬다(트러블: 카카오 앱에서 "지도/로컬" 서비스가 꺼져 있으면 sdk.js가 403).
- 로컬 실행: `npm install && npm start` → `http://localhost:8000` (반드시 localhost, GPS는 보안 컨텍스트 필요)

## Constraints

- **플랫폼**: 모바일 웹(PWA 이전 단계) — 앱 설치 없이 링크로 여는 것이 친구 모임 시나리오의 핵심 마찰 해소책
- **지도/위치 API**: 카카오맵 + Kakao Mobility — 국내(한국) 사용자 대상 최적화
- **배포 환경**: HTTPS 필수 — 브라우저 GPS(Geolocation API)는 보안 컨텍스트(HTTPS 또는 localhost)에서만 동작
- **데이터 영속성**: 현재 파일 기반(data.json) — Render 무료 플랜은 디스크가 없어 재배포 시 초기화됨(v1 범위 밖의 알려진 한계로 기록)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 가칭 "어디쯤" 유지 | 정식 네이밍은 기능 검증 이후로 연기 | — Pending |
| 참여자 식별은 닉네임만, 회원가입 없음 | 설치·가입 마찰 최소화가 친구 모임 타깃에 핵심 | ✓ Good |
| 위치 공유는 "출발" 버튼을 눌러야 시작 | 상시 공유 대비 심리적 부담 최소화 | ✓ Good |
| 도착 시 개인 위치 공유 자동 종료 + 도착 인원 명단 | 지도가 깔끔해지고 상황 파악이 쉬움 | ✓ Good |
| 카카오맵 + Kakao Mobility 채택 | 국내 대상 서비스에 최적 | ✓ Good |
| 플랫폼은 모바일 웹(PWA), 네이티브 아님 | 설치 없는 진입이 개발 속도·검증 속도보다 우선 | ✓ Good |
| 배포 호스트로 Render 선정, Dockerfile/render.yaml 준비 | 무료 티어 + WebSocket 지원 | — Pending (배포 미실행) |
| 이번 마일스톤(v1) 범위는 "배포 + 실기기 검증"까지로 한정 | PWA·DB전환·정식 브랜딩은 검증 완료 후 순서대로 진행하는 것이 리스크가 낮음 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-30 after initialization*
