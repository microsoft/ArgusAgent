<div align="center">

# Argus

### 面向长周期科研与工程的持久、可审查自主运行时

Argus 协调多个职责明确的 AI 角色，使复杂任务可以跨越单次模型调用持续规划、执行、
验证、暂停与恢复。

[![Build](https://github.com/microsoft/ArgusAgent/actions/workflows/build.yml/badge.svg)](https://github.com/microsoft/ArgusAgent/actions/workflows/build.yml)
[![License](https://img.shields.io/github/license/microsoft/ArgusAgent?style=flat-square)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22.12%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![arXiv](https://img.shields.io/badge/arXiv-2608.05144-b31b1b?style=flat-square&logo=arxiv&logoColor=white)](https://arxiv.org/abs/2608.05144)

[官方网站](https://argusbot.cn) ·
[视频演示](https://www.youtube.com/watch?v=i8Qy9HCboQE) ·
[技术报告](technical_report/argus-technical-report.pdf) ·
[功能说明](docs/FEATURES.md) ·
[English](README.md) / **简体中文**

`Manager` → `Planner` → `Engineer` ⇄ `Reviewer`

</div>

---

## 项目简介

大多数 Agent 面向一次对话或一次编码回合设计。Argus 面向真正需要持续推进的任务：
它持久化项目状态，将执行与判断分离，并从已经验证的进展继续工作，而不是每次重新
开始。

| 核心能力 | 说明 |
| --- | --- |
| **持久项目** | 任务、检查点、决策、Skill、证据与运行状态可跨 Session 和版本升级保留。 |
| **独立审查** | 执行与验证相互分离；Reviewer 独立检查证据、局限与完成状态。 |
| **四角色运行时** | Manager、Planner、Engineer 和 Reviewer 拥有明确的权威边界与职责。 |
| **真实工具调用** | Agent 直接操作文件、终端、API、实验和可检查产物。 |
| **领域扩展** | Vertical 可定义领域专属阶段、工具、证据要求与完成标准。 |
| **多种交互界面** | 支持终端座舱、Web UI、桌面宿主、聊天桥接、插件和 HTTP API。 |
| **多种后端** | 支持 GitHub Copilot CLI、Codex CLI、Claude Code、OpenCode、Pi、Grok Build、Qoder 与 DeepSeek Harness。 |

<p align="center">
  <img src="technical_report/figures/argus_architecture.png" width="900" alt="Argus 运行时架构">
</p>

## 运行模型

| 角色 | 权威 | 职责 |
| --- | --- | --- |
| **Manager** | 控制 | 理解 operator 意图、选择工作流，并管理阶段迁移。 |
| **Planner** | 方向 | 把目标拆分为可执行任务，并定义每项任务必须产出的证据。 |
| **Engineer** | 执行 | 实现代码、开展调研、运行实验，并生成可检查产物。 |
| **Reviewer** | 验证 | 独立检查正确性、证据质量、局限与完成状态。 |

Host 在四个角色之外持久化 campaign 状态。项目可以停止、恢复、跨运行时替换，并从
最近一次已验证位置继续推进。完整状态机、角色边界与可靠性行为见
[功能与运行流程说明](docs/FEATURES.md)。

## 安装

### 环境要求

- Python 3.11 或更高版本
- Node.js 22.12 或更高版本
- Git
- 至少一个已完成鉴权的受支持 Agent CLI

普通安装不需要 Docker。

### 源码安装

```bash
git clone https://github.com/microsoft/ArgusAgent.git
cd ArgusAgent

python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
pip install -e .
```

安装并登录一个后端。以 GitHub Copilot CLI 为例：

```bash
npm install -g @github/copilot
copilot login

argus --setup --non-interactive \
  --backend copilot \
  --accept-house-rules
argus
```

### npm beta

```bash
npm install -g @github/copilot
copilot login
npm install -g @argusevolve/argus@beta

argus --setup --non-interactive \
  --backend copilot \
  --accept-house-rules
argus
```

### 支持的后端

| 后端 | CLI 安装 | 鉴权 |
| --- | --- | --- |
| GitHub Copilot | `npm install -g @github/copilot` | `copilot login` |
| OpenAI Codex | `npm install -g @openai/codex@latest` | `codex login` |
| Claude Code | `npm install -g @anthropic-ai/claude-code` | 运行 `claude`，再执行 `/login` |
| Pi | `npm install -g --ignore-scripts @earendil-works/pi-coding-agent` | 运行 `pi`，再执行 `/login` |
| OpenCode | [官方安装说明](https://opencode.ai/docs/) | `opencode auth login` |
| Grok Build | [官方安装说明](https://x.ai/cli) | `grok login` |
| Qoder | `npm install -g @qoder-ai/qodercli` | `qodercli login` |
| DeepSeek Harness | `npm install -g @deepseek-ai/dsh` | 配置 dsh 模型 Provider |

## 使用 Argus

```bash
argus                                # 打开终端座舱
argus --web                          # 打开 Web UI
argus --status                       # 查看当前运行状态
argus doctor                         # 调用 Agent 检查并修复
argus doctor --advisor none --verify # 不调用模型的确定性检查
```

### 终端座舱

默认的 `argus` 命令会按需启动本地后端并打开终端座舱。你可以在其中与 Manager
对话、跟踪正在进行的工作、检查证据、回答仅由 operator 决定的问题并恢复项目。

### Web UI

```bash
argus --web
```

首选本地地址为 [http://127.0.0.1:8799](http://127.0.0.1:8799)；端口被占用时
Argus 会选择下一个可用端口。在远程服务器上，建议只监听 localhost 并使用 SSH
隧道：

```bash
ssh -L 8799:127.0.0.1:8799 user@server
```

### Code Agent 插件

仓库中的插件通过 MCP 和宿主专用 Skill 向 Codex 与 Claude Code 暴露 Argus。
安装命令和宿主行为见
[`plugins/argus/README.md`](plugins/argus/README.md)。

### Agent Skill 集成

可移植的
[`argus-runtime-orchestration`](integrations/agent-skills/argus-runtime-orchestration/SKILL.md)
Skill 允许其他具备工具能力的 Agent 调用 Argus、监控持久任务、处理 `Needs you`
干预并基于证据完成收尾。

## 项目结构

| 路径 | 说明 |
| --- | --- |
| [`argus_skill/`](argus_skill/) | Python 运行时、角色编排、Vertical、工具、WebAPI 与内置 Skill。 |
| [`frontend/`](frontend/) | 终端座舱、Web UI、共享前端协议与已构建生产 Bundle。 |
| [`desktop/`](desktop/) | Windows Electron 宿主与冻结后端打包。 |
| [`plugins/`](plugins/) | MCP 插件包与宿主专用 Skill。 |
| [`integrations/`](integrations/) | 面向外部 Agent 环境的可移植集成。 |
| [`tests/`](tests/) | 运行时、协议、集成与界面测试。 |
| [`technical_report/`](technical_report/) | 技术报告源码、证据、图表与编译后的 PDF。 |
| [`docs/FEATURES.md`](docs/FEATURES.md) | 已实现功能、运行流程与可靠性场景。 |

## 技术报告

仓库包含完整的报告材料：

- [编译后的 PDF](technical_report/argus-technical-report.pdf)
- [LaTeX 源码](technical_report/main.tex)
- [图表与来源记录](technical_report/figures/)
- [公开证据包](technical_report/evidence/)
- [arXiv:2608.05144](https://arxiv.org/abs/2608.05144)

## 开发

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
pip install -e ".[dev]"

python -m ruff check argus_skill tests
python -m pytest -q
python -m build
```

前端开发需要 Node.js 22.12 或更高版本：

```bash
npm --prefix frontend/web ci
npm --prefix frontend/web test
npm --prefix frontend/web run typecheck

npm --prefix frontend/tui ci
npm --prefix frontend/tui test
```

## 更新源码安装

```bash
cd ArgusAgent
git pull --ff-only
. .venv/bin/activate
pip install -e .
argus --version
argus doctor --advisor none --verify
```

## 安全与支持

- 报告漏洞前请阅读[安全策略](SECURITY.md)，不要通过公开 GitHub Issue 披露安全漏洞。
- Bug 与功能请求请使用
  [GitHub Issues](https://github.com/microsoft/ArgusAgent/issues)，并遵循
  [SUPPORT.md](SUPPORT.md) 中的说明。
- 参与社区前请阅读[行为准则](CODE_OF_CONDUCT.md)。

## 参与贡献

本项目欢迎贡献与建议。大多数贡献者需要签署 Microsoft Contributor License
Agreement（CLA），声明你有权授予 Microsoft 使用该贡献所需的权利。详细信息见
[Microsoft CLA](https://cla.opensource.microsoft.com/)。

提交 Pull Request 后，CLA Bot 会自动检查是否需要签署，并在 PR 中给出提示。
对于使用 Microsoft CLA 的仓库，通常只需签署一次。

本项目遵循
[Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/)。
更多信息见
[Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/)，
或联系 [opencode@microsoft.com](mailto:opencode@microsoft.com)。

## 商标

本项目可能包含项目、产品或服务的商标或 Logo。Microsoft 商标或 Logo 的授权使用
必须遵循
[Microsoft Trademark & Brand Guidelines](https://www.microsoft.com/legal/intellectualproperty/trademarks/usage/general)。
修改版本不得造成混淆或暗示 Microsoft 提供赞助。第三方商标与 Logo 的使用应遵循
对应第三方的政策。
