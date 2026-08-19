# Research Workflow Skill for Pi / Hermes

> An unofficial community workflow inspired by Argus's separation of planning,
> execution, and review.

## What this is

`SKILL.md` is a standalone Agent Skill for users who already run Pi or Hermes.
It adds an adaptive workflow for multi-step research, surveys, feasibility studies,
experiments, and evidence-heavy analysis. It does **not** install or embed the Argus
runtime.

The Skill uses several working modes inside the host agent:

```text
Ground objective
  → plan the smallest useful task graph
  → gather only decision-relevant evidence
  → execute one coherent task
  → run a critic pass against explicit criteria
  → accept, revise, replan, or report a blocker
  → retain bounded cross-task learning when it changes later work
  → synthesize the requested deliverable
```

Iterations are driven by material evidence gaps, not by a mandatory number of
rounds. External search is used only when available, authorized, and useful.

## Relationship to Argus

This contribution borrows an architectural idea from Argus but is not a replacement
for the same runtime guarantees.

| Capability | Argus | This community Skill |
|---|---|---|
| Runtime | Persistent Python runtime with Manager, Planner, Engineer, and Reviewer control boundaries | Instructions loaded by an existing Pi/Hermes session |
| Review | Separate Reviewer turn with runtime-enforced handoff and verdict handling | Critic working mode in the host agent; isolated only if the host launches a separate subagent/context |
| Persistence | Event journal, checkpoints/handoffs, failure experience, project Skills, and shared Wiki | Optional Markdown state under `.research-workflow/` |
| Cross-task learning | Prior mission evidence reaches Planner and later missions; durable procedures/facts can be retained in project Skills/Wiki | A bounded `LEARNINGS.md` entry and replan gate when evidence changes downstream work |
| Planning | Planner uses project state and prior outcomes; Manager owns stage transitions | A lightweight task graph updated by the current agent |
| Setup | Install and configure the Argus runtime and one supported backend | Copy one Skill into an already configured Pi/Hermes installation |

Neither approach guarantees research quality merely by naming roles or adding
rounds. Results still depend on model capability, tool access, evidence quality,
and the rigor of the actual checks.

## Design principles

- **Evidence before ceremony:** no forced R1/R2/R3 sequence.
- **Adaptive depth:** revise only for a named material gap with a decisive check.
- **Truthful tool use:** unavailable search, data, or verification is disclosed,
  never fabricated.
- **Source integrity:** primary sources and first-hand measurements are preferred;
  retrieved content is treated as untrusted data rather than executable authority.
- **Selective memory:** retain only learning that changes future work, with explicit
  applicability limits.
- **Recoverability when needed:** longer work can use `STATE.md`, `EVIDENCE.md`,
  `DECISIONS.md`, and `LEARNINGS.md`; small tasks create no workflow bureaucracy.

## Installation

Review `SKILL.md` before installing it. Skills can direct an agent to use tools and
modify files.

### Pi — global

```bash
mkdir -p ~/.pi/agent/skills/research-workflow
cp SKILL.md ~/.pi/agent/skills/research-workflow/SKILL.md
```

Pi discovers global skills at startup. Start a new session, allow automatic loading
for a matching research request, or explicitly invoke:

```text
/skill:research-workflow <your research objective>
```

### Pi — project-local

From a trusted project:

```bash
mkdir -p .pi/skills/research-workflow
cp SKILL.md .pi/skills/research-workflow/SKILL.md
```

### Hermes

```bash
mkdir -p ~/.hermes/skills/research-workflow
cp SKILL.md ~/.hermes/skills/research-workflow/SKILL.md
```

Skill discovery and invocation can vary by Hermes version; follow the documentation
for the installed version if it does not discover the directory automatically.

## Limitations

- A Markdown Skill cannot enforce process isolation, daemon persistence, or an
  independent Reviewer by itself.
- Web search, browser access, subagents, and long-running process support depend on
  the host agent and its configured tools.
- The workflow is intentionally not activated for simple factual questions or
  one-step edits.
- The optional `.research-workflow/` state is project-local and should not contain
  credentials, private source text, or large raw artifacts.

## Attribution

Inspired by [Argus](https://github.com/microsoft/ArgusAgent), especially its separation of
planning, execution, and review and its use of durable project memory. This Skill is
an independent community contribution, not an official Argus compatibility layer or
a benchmarked claim of superiority.
