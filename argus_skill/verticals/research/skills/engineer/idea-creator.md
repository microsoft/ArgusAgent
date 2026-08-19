---
name: "Idea Creator"
description: "Given IDEA_CANDIDATES.md from idea-discovery, rank candidates and run the cheapest faithful falsification or characterization probe within the operator's budget. Positive, negative, diagnostic, and boundary findings may all justify an experiment plan when they have research value."
---

# Idea Creator — rank, pilot, commit

> Adapted from ARIS `idea-creator` skill (MIT, © 2026 wanshuiyin).

`idea-discovery` streams independent routes; `idea-creator` reviews each route
as soon as it lands, then records one short advisory feasibility check only when
it is representative. The review chooses the idea; research-stage empirical
success does not. Large-scale/training-heavy ideas may skip the probe as untested
and proceed to plan/benchmark/run.

For publishable/doctoral selection, the ambition standard is a nontrivial
technical core, verified originality, claim-relevant formal/causal grounding,
and field-level consequence. The selected contribution must be a high-novelty
method/architecture/training objective/algorithm or a publication-scale empirical
study across multiple model families, datasets/tasks, strongest current baselines,
and robust repeated trials. Feasibility is a staged resource plan, not compensation
for weakness and not a reason to prefer no-training, shortest-evidence-path, cheap,
small-model, or single-GPU work.

## When to invoke

- `research/IDEA_CANDIDATES.md` exists
- Project hasn't yet committed to an experiment plan
- Budget allows a faithful bounded probe (operator-set, not harness-set)

## Workflow

### Step 1 — independently review each completed candidate

A fresh reviewer reads one completed route without waiting for the rest of the
portfolio, independently checks the latest 12 months of arXiv and current major
venue cycle, and judges **frontier_freshness × novelty × technical_depth ×
theoretical_foundation × stake × publication_scale** qualitatively. Qualify a route when
it looks strong, professional, novel, and developable; do not demand a finished
theorem, fixed implementation, or reliable quantitative result during research.
The same schema may be used to summarize the route:

```json
{
  "ranking": [
    {"id": "I-1", "novelty": "high", "technical_depth": "high",
     "theoretical_foundation": "high", "tractability": "med", "stake": "high",
     "local_feasibility": "executable", "rank_score": 0.81,
     "pilot_recommendation": "run"},
    {"id": "I-2", "novelty": "med", "technical_depth": "low",
     "theoretical_foundation": "low", "tractability": "high", "stake": "med",
     "local_feasibility": "conditional", "rank_score": 0.0,
     "pilot_recommendation": "queue"},
    {"id": "I-3", "novelty": "high", "technical_depth": "high",
     "theoretical_foundation": "high", "tractability": "high", "stake": "high",
     "local_feasibility": "unfeasible", "rank_score": 0.0,
     "pilot_recommendation": "drop"}
  ]
}
```

`local_feasibility` ∈ {`executable`, `conditional`, `unfeasible`, `unknown`}
comes straight from the candidate's `Local Feasibility` block. It governs the
smoke probe, not scientific ranking. A high-ambition candidate that exceeds local
resources remains selectable with `conditional` feasibility and a concrete staged
resource plan; skip or replace only its local smoke rather than substituting a weaker
idea. A genuinely impossible evidence path under any plausible resource plan remains
ineligible.

Likewise, a candidate that is incremental, technically shallow, lacks a genuine
formal/causal foundation, or has no field-level consequence must not be
recommended `run` merely because it is cheap. Reject decorative mathematics:
the foundation score concerns real derivations or mechanism-specific
predictions, not notation density.

Complete this route-local selection from literature, formal/causal analysis,
closest-method reduction attempts, and qualitative feasibility before its
probe. Do not wait for unfinished routes. Reject only clear prior-art collisions,
trivial wrappers, incoherent mechanisms, or ideas with no credible evidence
path. A small diagnostic, taxonomy, benchmark audit, or negative result is not
enough unless its planned evaluation is publication-scale and its conclusion would
change a field-level belief. Probe outcomes must not retroactively reverse a qualified review. A
`queue` or `drop` candidate receives no model, API, or GPU calls; a `run`
recommendation makes the route eligible for immediate greedy selection.

### Step 2 — design probes for the top candidates

Only after Step 1 has selected a candidate as `run`, optionally write its tiny
**resource-adaptive smoke-probe spec**. Target at most ten minutes and the
smallest real slice that checks wiring, data shape, or evaluator availability.
Do not use a miniature slice to judge whether a large-scale empirical idea succeeds.
If no representative cheap check exists, record `skipped` / `untested` and advance.
Do not run the formal benchmark, training, broad ablations, large sweeps, or a
publication-scale multi-seed study here; those belong to later stages.
Instantiate the Planner-authored evidence contract: Engineer may choose
implementation details such as batching, caching, file layout, and safe
scheduling, but must not silently change the frozen premise, strongest
comparison, primary observation, interpretation rule, or budget.

```markdown
## Pilot P-{{id}}: <one-line goal>

**Falsifiable hypothesis**: <claim from IDEA_CANDIDATES.md>

**Minimum signal**: <smallest measurement that would already
distinguish hypothesis from null>

**Setup**:
- Models: <subset>
- Prompts: <N samples, source>
- Trial count: <minimum-N for the signal to be visible>
- Token budget: <estimate>

**Stop rules**:
- Record the first honest observation and its limitations
- Do not enlarge merely to obtain a decisive result
- Continue the qualified idea into planning; treat weak/null evidence as a
  later implementation or experiment-design question
```

### Step 3 — execute pilots in parallel

Keep route reviews parallel until at least 80% of the configured routes are
complete (10 of 12 by default). Then let one fresh selector Agent choose the
strongest review-qualified current-frontier idea. The winner must be a high-novelty
method or publication-scale empirical contribution; no-training convenience,
shortest evidence path, cheapness, and single-GPU fit are not ranking advantages.
Do not wait for the final two routes and do not use probe outcomes in this comparison.

Run one short advisory probe only when it is informative for feasibility; otherwise
record an untested skip. The probe's four-state evidence status does not reopen or
reverse selection, and scientific success remains downstream work.

### Step 4 — record verdicts

Each pilot writes:
- `experiments/pilot-{{id}}/RESULTS.md` — measurement summary
- `experiments/pilot-{{id}}/VERDICT.md` — reviewer-written
  engineering-validity and hypothesis-evidence verdict
- the existing `research/ideas/<id>/EVIDENCE.json` four-state record, keeping
  execution validity separate from `untested` / `inconclusive` / `supported` /
  `refuted`

### Step 5 — commit the greedy winner

Materialize the quorum selector's choice as `research/IDEA_SELECTION.json`, record
or skip one bounded advisory feasibility check, and build the full experiment plan
around it. The
smoke result does not need to support the premise. Preserve weak/null evidence
as an implementation or design note and allow the idea to evolve through later
experiments. The final two route results remain audit evidence but do not block
or silently replace the selected thesis.

## Anti-patterns

- ❌ Pilot all candidates fully instead of using the cheapest faithful probe
- ❌ Decide from the first route before the 80% review quorum
- ❌ Wait for all routes after the 80% quorum is available
- ❌ Kill a strong idea because a smoke probe is weak, null, noisy, or inconclusive
- ❌ Expand a probe into a formal benchmark or long multi-seed experiment
- ❌ Freeze the initial idea wording; later engineering evidence should refine it

## Output contract

Writes per-route review/probe artifacts, a four-state `EVIDENCE.json` for each
probed candidate, `research/IDEA_SELECTION.json`, and the selected candidate's
`research/EXPERIMENT_PLAN.md`.
