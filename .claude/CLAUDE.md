<!-- GSD:project-start source:PROJECT.md -->

## Project

**어디쯤**

모임(장소·날짜·시간)을 만들고 초대 링크를 공유하면, 당일 참석자들이 설치·가입 없이 닉네임만으로 참여해 지도 위에서 서로의 실시간 위치와 도착 예정 시간(ETA)을 함께 보는 모바일 웹 서비스. 20~30대 친구 모임을 1차 타깃으로 한다.

**Core Value:** 먼저 도착한 사람이 "늦는 사람이 얼마나 남았는지"를 바로 알아 대기할지 이동할지 스스로 판단할 수 있게 하는 것 — 정확한 위치보다 신뢰할 수 있는 ETA가 핵심이다.

### Constraints

- **플랫폼**: 모바일 웹(PWA 이전 단계) — 앱 설치 없이 링크로 여는 것이 친구 모임 시나리오의 핵심 마찰 해소책
- **지도/위치 API**: 카카오맵 + Kakao Mobility — 국내(한국) 사용자 대상 최적화
- **배포 환경**: HTTPS 필수 — 브라우저 GPS(Geolocation API)는 보안 컨텍스트(HTTPS 또는 localhost)에서만 동작
- **데이터 영속성**: 현재 파일 기반(data.json) — Render 무료 플랜은 디스크가 없어 재배포 시 초기화됨(v1 범위 밖의 알려진 한계로 기록)

<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->

## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
