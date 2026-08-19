# Hermes Agent adapter

**Evidence level:** documented from current official Hermes Agent docs/README; Hermes was not installed for local execution testing.

- Discovery: Hermes uses `~/.hermes/skills/` as its primary skill store and can scan configured `skills.external_dirs`, including `~/.agents/skills`. Installed skills become slash commands and can also load by relevance. External directories are mutable if writable; filesystem permissions, not `external_dirs`, provide write protection.
- Shell/process: enable terminal/file tooling. Hermes documents `terminal(..., background=true)` returning a session id and a `process` tool for list/poll/wait/log/kill/write. PTY mode supports interactive CLIs. Terminal execution environments include local and isolated/remote options.
- Durability: process management is environment- and version-dependent. Some Docker configurations preserve processes, while Modal/Vercel-style recovery may preserve files without preserving live PIDs. Durable Argus project state is the invariant. Verify the active environment before relying on `--daemon`; otherwise relaunch Argus against the saved workdir/project state and treat Hermes process handles as conditional live monitoring.
- Approvals: `smart` and `manual` modes guard dangerous commands and approval timeout fails closed. `off` disables approval prompts like a YOLO mode; only hardline blocks and configured deny rules remain, so it is not a portability default. Messaging surfaces can route approval questions. Isolated container environments may use the container as the boundary. Do not disable safeguards to obtain unattended operation.
- Limit: when terminal, process, PTY, or a reachable approval surface is disabled for the current toolset/platform, fall back exactly as the core describes.
- Model: Hermes Agent is the outer operator; Argus is the other party. Do not elevate Argus's configured internal provider CLI into a Hermes peer.

Sources: https://hermes-agent.nousresearch.com/docs/user-guide/features/skills ; https://hermes-agent.nousresearch.com/docs/user-guide/features/tools ; https://hermes-agent.nousresearch.com/docs/user-guide/security ; https://github.com/NousResearch/hermes-agent
