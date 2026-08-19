# Argus

**English** · [简体中文](README.zh-CN.md)

## Overview

Argus is an autonomous research and engineering runtime for long-horizon work. It coordinates four persistent AI roles:

- **Manager** — interprets operator intent, selects the workflow, and controls stage transitions.
- **Planner** — decomposes the objective into executable tasks and evidence requirements.
- **Engineer** — implements, researches, runs experiments, and produces artifacts.
- **Reviewer** — independently checks correctness, evidence, limitations, and completion.

Project state, task history, checkpoints, skills, and review evidence are persisted across sessions. Argus supports GitHub Copilot CLI, OpenAI Codex CLI, Claude Code, OpenCode, and Pi backends.

[Technical Report PDF](technical_report/argus-technical-report.pdf)

## Installation

### Requirements

- Python 3.11 or newer
- Node.js 22 or newer
- One supported agent CLI with valid authentication

### Source installation

```bash
git clone https://github.com/microsoft/ArgusAgent.git
cd ArgusAgent

python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
pip install -e .
```

Install and authenticate one backend. For GitHub Copilot:

```bash
npm install -g @github/copilot
copilot login
argus --setup --non-interactive \
  --backend copilot \
  --accept-house-rules
argus
```

For Pi:

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
pi  # run /login, then exit Pi after authentication
argus --setup --non-interactive \
  --backend pi \
  --accept-house-rules
argus
```

Other supported backend installers:

```bash
npm install -g @openai/codex@latest
npm install -g @anthropic-ai/claude-code
curl -fsSL https://opencode.ai/install | bash
```

### npm beta installation

```bash
npm install -g @github/copilot
copilot login
npm install -g @argusevolve/argus@beta
argus --setup --non-interactive \
  --backend copilot \
  --accept-house-rules
argus
```

### Update a source installation

```bash
cd ArgusAgent
git pull --ff-only
. .venv/bin/activate
pip install -e .
argus
```

## Contributing

This project welcomes contributions and suggestions. Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit [Contributor License Agreements](https://cla.opensource.microsoft.com).

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the pull request appropriately. You only need to do this once across all repos
using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information, see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/)
or contact [opencode@microsoft.com](mailto:opencode@microsoft.com).

## Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use
of Microsoft trademarks or logos is subject to and must follow
[Microsoft's Trademark & Brand Guidelines](https://www.microsoft.com/legal/intellectualproperty/trademarks/usage/general).
Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion
or imply Microsoft sponsorship. Any use of third-party trademarks or logos is subject to those
third parties' policies.
