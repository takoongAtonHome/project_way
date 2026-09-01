---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-09-01T01:17:12.690Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | quick-260901-dww | unrun-verify | index.html |  | Task 3 human-check (실기기 네이티브 피커/5분 스냅/한국어 표시/초대 round-trip 육안 확인) 미실행 — 자동 verify:datetime-picker로 형식/round-trip 계약은 검증됨 | open |  | 2026-09-01T01:17:12.690Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "quick-260901-dww",
    "file": "index.html",
    "line": null,
    "description": "Task 3 human-check (실기기 네이티브 피커/5분 스냅/한국어 표시/초대 round-trip 육안 확인) 미실행 — 자동 verify:datetime-picker로 형식/round-trip 계약은 검증됨",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-01T01:17:12.690Z",
    "resolved_at": null
  }
]
````
