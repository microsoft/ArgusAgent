# OpenClaw adapter

**Evidence level:** locally tested on OpenClaw 2026.7.1 for binary presence/version and this run's `exec`/`process` surfaces; skill loading, execution, and approvals are also documented officially.

- Discovery: install under `<workspace>/skills`, `<workspace>/.agents/skills`, `~/.agents/skills` (default state), managed state skills, or a configured extra directory. OpenClaw discovers `SKILL.md` recursively within configured roots; location precedence and per-agent allowlists apply. Explicit invocation is available through the host's supported skill reference/slash surface.
- Shell/process: use `exec` with the dedicated Argus workdir. Use PTY for the cockpit. In the documented/current tested release, `exec` can foreground or background; `process` can inspect logs/status/input only for sessions owned by the same agent. Feature-detect this on other releases. If `process` is unavailable, `exec` is synchronous and ignores background controls.
- Durability: agent-started background sessions are useful for live observation and can produce completion wakes, but Argus `--daemon` plus its project state is the cross-turn recovery anchor. Do not emulate monitoring with polling/sleep loops.
- Approvals: host exec policy and host-local approval policy combine; the stricter result wins. If a call returns approval-pending, it has not started. Use native approval cards/buttons first; use a manual approval command only when OpenClaw explicitly says that is required. Never run an approval command through shell.
- Limit: background `process` handles are agent-scoped, so another agent may not see them. Re-enter by exact workdir and `argus --status`.
- Model: OpenClaw is the outer operator. Any model/provider CLI configured inside Argus remains an Argus implementation detail, even if it is also named OpenAI Codex, GitHub Copilot, or Claude.

Sources: https://docs.openclaw.ai/tools/skills ; https://docs.openclaw.ai/tools/exec ; https://docs.openclaw.ai/tools/exec-approvals
