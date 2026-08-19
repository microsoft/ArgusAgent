# Codex CLI adapter

**Evidence level:** locally tested for Codex CLI 0.144.5 binary/version/help and noninteractive execution flags; skill discovery, AGENTS.md, sandboxing, network, and approvals are documented officially.

- Discovery: Codex reads skills from `.agents/skills` along the CWD-to-repository-root chain, `~/.agents/skills`, `/etc/codex/skills`, and bundled locations. Use `$skill-name` or `/skills` where supported. `AGENTS.md` is a separate instruction chain, not a substitute for proving skill discovery.
- Shell/process: Codex can execute shell commands and supports interactive and `codex exec` modes. Run from the dedicated Argus workdir. Codex CLI documentation does not establish a general durable host process manager equivalent to Argus; therefore launch Argus's own `--daemon` for unattended work and use later `--status` checks. A shell background job alone is conditional and should not be advertised as durable.
- Approvals/sandbox: the two layers are sandbox mode and approval policy. Default/Auto typically grants workspace writes with network off and asks for escapes/network. Protected `.agents`, `.codex`, and `.git` paths remain read-only in workspace-write. `--ask-for-approval never` removes prompts but does not widen sandbox access; dangerous full access removes both protections and is not a portability default.
- Network/API: local HTTP calls to an Argus loopback API may be blocked by active network/local-binding policy. Terminal/cockpit and `--status` remain sufficient.
- Limit: current official docs say Codex may shorten/omit entries from the initial skills index when many are installed and warns when it does; invoke explicitly and verify loading. They also advise restarting if a changed skill is not detected. Treat both as release-sensitive.
- Model: Codex CLI is the outer operator. If Argus is configured to use Codex internally, that is Argus configuration, not a second Codex actor or third operational party.

Sources: https://learn.chatgpt.com/docs/build-skills ; https://learn.chatgpt.com/docs/agent-configuration/agents-md ; https://learn.chatgpt.com/docs/agent-approvals-security
