---
name: argus-status
description: Use when checking an Argus project's progress, pending questions, active role, diagnostics, selected artifacts, intervention state, recovery options, or graceful stop status.
---

# Inspect And Control Argus

1. Resolve the project ID from the user's explicit ID or call
   `argus_project_list` for the exact work directory.
2. Call `argus_status`. Report daemon state, active role, completed and pending
   work, pending operator questions, and continuous objective separately.
3. Call `argus_artifacts` when the user asks for outputs. Report only existing
   allowlisted artifacts returned by Argus.
4. Call `argus_doctor` only when status exposes a runtime/backend fault or the
   user requests diagnostics.
5. Send ordinary steering or answers through `argus_message`; Manager remains
   the operator front door.
6. Call `argus_stop` only on an explicit stop request. Keep `force=false` unless
   the user explicitly requests a force stop after understanding interruption
   risk.

Do not count provider, transport, interrupted, or resource failures as task
failures. Do not translate training loss or activity into a successful result.
