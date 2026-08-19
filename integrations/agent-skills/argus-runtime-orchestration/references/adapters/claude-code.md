# Claude Code adapter

**Evidence level:** documented from current official Claude Code docs; Claude Code was not installed for local execution testing.

- Discovery: project skills live in `.claude/skills/<name>/SKILL.md`; personal skills in `~/.claude/skills`. Claude Code follows the Agent Skills standard and supports explicit `/skill-name` invocation plus automatic relevance matching. Discovery from parents/nested directories and added directories has version-sensitive details; verify with the active CLI.
- Shell/process: use the available Bash or PowerShell tool from the dedicated workdir; in native PowerShell invoke Argus as `& $ArgusBin ...`. Claude Code's current CLI documents background sessions (`claude agents`), JSON listing, attach/log commands, and a supervisor daemon. In-session shell tooling also supports background-task controls in current releases. If these features are unavailable in the installed version, use Argus `--daemon` only where the environment preserves processes, and otherwise relaunch from durable state.
- Durability: do not assume an in-session task handle survives every host restart. Current documented background-session supervisor is stronger than a shell job, but Argus project identity remains the recovery key.
- Approvals: permission rules evaluate deny, then ask, then allow. Standard mode prompts for shell/file mutation; modes include plan/read-only, auto, dontAsk, and bypassPermissions. Do not select bypassPermissions for convenience; it is intended only for isolated environments and explicit ask/managed rules can still prompt.
- Limit: cloud/Cowork sessions do not read local personal skills; commit project skills or use supported account/plugin distribution. A local Argus install is usable only where that session can access and execute it.
- Model: Claude Code is the outer operator. A Claude CLI or model configured internally by Argus is not an additional party and must not be conflated with the outer Claude Code session.

Sources: https://code.claude.com/docs/en/skills ; https://code.claude.com/docs/en/permissions ; https://code.claude.com/docs/en/cli-reference
