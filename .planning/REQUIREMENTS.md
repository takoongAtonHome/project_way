# Requirements: 어디쯤

**Defined:** 2026-07-30
**Core Value:** 먼저 도착한 사람이 늦는 사람의 ETA를 바로 알아 대기할지 이동할지 스스로 판단할 수 있게 한다.

## v1 Requirements

로컬 프로토타입(카카오맵+GPS+실시간 WS 백엔드)은 검증 완료. v1은 이를 실제 인터넷 환경(HTTPS 배포)과 실제 기기에서 검증하는 데 집중한다.

### Deployment

- [ ] **DEPLOY-01**: 코드가 GitHub 원격 저장소에 push 되어 있다
- [ ] **DEPLOY-02**: 서비스가 HTTPS 주소로 배포되어 외부 인터넷에서 접근 가능하다
- [ ] **DEPLOY-03**: 배포 환경에서 서버 재시작 후에도 배포 세션 동안 모임 데이터(data.json)가 유지된다

### Kakao Integration

- [ ] **KAKAO-01**: 배포된 URL이 카카오 디벨로퍼스 플랫폼의 Web 도메인에 등록되어 있다
- [ ] **KAKAO-02**: 배포 환경에서 카카오맵 SDK가 403 등 오류 없이 정상 렌더링된다

### Verification

- [ ] **VERIFY-01**: 실제 휴대폰 2대 이상이 같은 모임에 참여해 지도에서 서로의 실시간 위치를 본다
- [ ] **VERIFY-02**: 참여자가 도착 반경(80m) 내에 진입하면 해당 참여자의 위치 공유가 자동 종료되고 "도착 인원" 명단에 반영된다
- [ ] **VERIFY-03**: 모임 생성 → 초대 링크 참여(닉네임만) → 출발 → 도착까지 전체 흐름이 배포 환경(HTTPS)에서 실기기로 끊김 없이 동작한다

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Platform

- **PWA-01**: 서비스가 홈 화면에 설치 가능한 PWA로 전환된다 (manifest + 서비스워커)

### Data

- **DATA-01**: 모임 데이터가 외부 DB(Postgres 등)에 저장되어 재배포에도 초기화되지 않는다

### Branding

- **BRAND-01**: 서비스에 정식 이름과 아이콘·비주얼 디자인이 확정된다

### Routing

- **ROUTE-01**: 카카오모빌리티 길찾기 API를 통한 정확한 경로 기반 ETA가 활성화된다 (`KAKAO_REST_KEY` 연동)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| 채팅 | 약속 관리는 위치 공유를 켜기 위한 최소 기능만 유지 — 차별점(당일 ETA 경험)에 집중 |
| 참석투표(RSVP) | 위와 동일 — scope creep 경계 |
| 장소 추천 | 위와 동일 |
| 정산 | 위와 동일 |
| 리마인더 알림 | 위와 동일 |
| 백그라운드(앱 종료 시) 위치 추적 | 모바일 웹의 기술적 한계, 네이티브 앱 단계에서 재검토 |
| 푸시 알림 | 백그라운드 추적과 동일한 이유로 네이티브 단계로 연기 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEPLOY-01 | TBD | Pending |
| DEPLOY-02 | TBD | Pending |
| DEPLOY-03 | TBD | Pending |
| KAKAO-01 | TBD | Pending |
| KAKAO-02 | TBD | Pending |
| VERIFY-01 | TBD | Pending |
| VERIFY-02 | TBD | Pending |
| VERIFY-03 | TBD | Pending |

**Coverage:**
- v1 requirements: 8 total
- Mapped to phases: 0
- Unmapped: 8 ⚠️ (필요 시 roadmap 생성 단계에서 채움)

---
*Requirements defined: 2026-07-30*
*Last updated: 2026-07-30 after initial definition*
