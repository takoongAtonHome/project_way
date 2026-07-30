# Roadmap: 어디쯤

## Overview

로컬 프로토타입(카카오맵 + GPS + Node/ws 실시간 위치 릴레이 + ETA + 도착 자동 종료)은 이미 완성되어 검증까지 끝난 상태다. 남은 v1 범위는 새 기능 개발이 아니라 "이미 만든 것을 실제 인터넷에 올리고, 카카오맵이 배포 환경에서도 뜨게 만들고, 실제 휴대폰 2대 이상으로 전체 흐름이 끊김 없이 동작하는지 확인하는 것"이다. 이 세 단계(배포 → 카카오 도메인 등록 → 실기기 검증)는 순서대로 의존하는 단일 트랙이며, 각 단계가 다음 단계의 전제조건이 된다.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: 프로덕션 배포** - GitHub push + Render HTTPS 배포로 서비스가 외부 인터넷에서 접근 가능해진다
- [ ] **Phase 2: 카카오맵 도메인 등록** - 배포 URL을 카카오 디벨로퍼스에 등록해 배포 환경에서 지도가 정상 렌더링된다
- [ ] **Phase 3: 실기기 통합 검증** - 실제 휴대폰 2대 이상으로 모임생성부터 도착까지 전체 흐름을 배포 환경에서 검증한다

## Phase Details

### Phase 1: 프로덕션 배포
**Goal**: 코드가 GitHub에 push되고 Render(또는 동등 호스트)에 HTTPS로 배포되어, 인터넷 어디서든 접근 가능하며 배포 세션 동안 모임 데이터가 유지된다.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03
**Success Criteria** (what must be TRUE):
  1. 개발자가 `git push`로 GitHub 원격 저장소(main)에 최신 코드를 push할 수 있다
  2. 브라우저에서 배포된 HTTPS URL로 접속하면 어디쯤 앱의 홈 화면이 정상적으로 로드된다
  3. 배포 환경에서 모임을 생성한 뒤 서버가 재시작되어도(같은 배포 세션 내) 해당 모임 데이터가 여전히 조회된다
**Plans**: TBD

Plans:
- [ ] 01-01: GitHub 원격 저장소 연결 및 push
- [ ] 01-02: Render HTTPS 배포 및 데이터 영속성 확인

### Phase 2: 카카오맵 도메인 등록
**Goal**: 배포된 HTTPS URL이 카카오 디벨로퍼스 플랫폼의 Web 도메인에 등록되어, 배포 환경에서도 카카오맵이 오류 없이 렌더링된다.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: KAKAO-01, KAKAO-02
**Success Criteria** (what must be TRUE):
  1. 카카오 디벨로퍼스 콘솔의 Web 플랫폼 도메인 목록에 배포 URL이 등록되어 있다
  2. 배포된 URL에서 지도 화면에 진입하면 카카오맵 SDK가 403 등 오류 없이 정상적으로 렌더링된다
**Plans**: TBD

Plans:
- [ ] 02-01: 카카오 디벨로퍼스에 배포 URL 등록 및 지도 렌더링 확인

### Phase 3: 실기기 통합 검증
**Goal**: 실제 휴대폰 2대 이상으로 모임 생성 → 초대 링크 참여(닉네임만) → 출발 → 도착까지 전체 흐름이 배포 환경(HTTPS)에서 끊김 없이 동작함을 확인한다.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: VERIFY-01, VERIFY-02, VERIFY-03
**Success Criteria** (what must be TRUE):
  1. 휴대폰 A가 모임을 생성하고 초대 링크를 공유하면, 휴대폰 B가 설치·가입 없이 닉네임만으로 같은 모임에 참여할 수 있다
  2. 두 휴대폰이 "출발"을 누르면 지도 위에서 서로의 실시간 위치와 ETA가 갱신되며 보인다
  3. 참여자가 도착 반경(80m) 안에 진입하면 해당 참여자의 위치 공유가 자동 종료되고 "도착 인원" 명단에 반영된다
  4. 모임 생성부터 도착까지 전체 흐름이 배포 환경(HTTPS)에서 오류나 끊김 없이 완료된다
**Plans**: TBD

Plans:
- [ ] 03-01: 실기기 2대 이상으로 전체 흐름 종단 검증

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. 프로덕션 배포 | 0/2 | Not started | - |
| 2. 카카오맵 도메인 등록 | 0/1 | Not started | - |
| 3. 실기기 통합 검증 | 0/1 | Not started | - |
