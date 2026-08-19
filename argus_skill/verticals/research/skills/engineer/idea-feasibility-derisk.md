---
name: "Research Reality Probe"
description: "Run the cheapest faithful observation that informs a research idea, preserve the raw result, and leave its interpretation and next move to the Planner."
---

# Research Reality Probe

## Purpose

After an idea has passed method-reasonableness selection, obtain one short real
observation before committing substantial compute. This is advisory context,
not a routing gate, not a miniature benchmark, and never a reason by itself to
kill or replace a promising idea.

For publishable/doctoral work, a successful probe does not waive the ambition
standard: nontrivial technical core, verified originality, claim-relevant
formal/causal grounding, and field-level consequence. Wiring success or easy
feasibility cannot promote a shallow idea.

## How to work

1. Read the research brief and the completed selection reasoning. If technical
   validity, prior-art reduction, originality, significance, falsifiability, or
   resource feasibility is still unresolved, stop before model/API/GPU execution
   and finish selection first. Otherwise identify the selected idea's uncertain
   empirical premise whose answer would most change the plan.
2. Choose the cheapest short probe that can touch it. Target at most ten minutes
   and a tiny real slice. Never run the formal benchmark, training, large sweep,
   or publication-scale multi-seed evaluation in this step. If a faithful test
   cannot fit that budget, record the limitation and continue to planning rather
   than inflating the probe. For a comparison, note whether the baseline has
   headroom and whether the slice exercises the mechanism, but do not enlarge
   the smoke test to obtain statistical power.
3. Record the setup before running: model/system identity, data slice, comparator
   or control, metric/observation, and the limitations of the probe.
4. Before any paid or model-backed call, inspect the prediction boundary:
   - candidate and baseline code may receive only information available at their
     claimed decision time, never gold labels, expected outcomes, scorer verdicts,
     or fields derived from them;
   - remove or permute hidden labels and confirm candidate predictions do not
     change;
   - execute baselines with the same information and intervention timing. A
     historical trace that already executed an action or a post-hoc verifier is a
     diagnostic, not an online prevention baseline.
5. Run it for real and preserve the command, raw output, and analysis under a
   sensible project path. Reuse existing run conventions instead of creating a
   special de-risk packet.
6. Write a short factual note in `research/RESEARCH_BRIEF.md` or the existing
   experiment log:
   - what was observed;
   - what remains uncertain;
   - plausible explanations, including implementation weakness;
   - paths to the raw material.

Do not emit PASS/FAIL, force a pivot, or automatically schedule another direction.
The selected idea continues after one bounded attempt. A weak/null result may
reflect the probe setup, implementation, scale, or current idea version; record
that ambiguity as inconclusive context for later small-step iteration. A wiring
smoke test is not evidence for or against the scientific thesis.

## Integrity

Never type expected numbers as results, hide failed calls, or relabel synthetic
examples as public evidence. If the probe is not faithful enough to inform the
premise, say so plainly. A result produced by candidate code reading the gold
label is a failed probe, not weak supporting evidence.

## Handoff

Report the observation and its limits in ordinary prose, with paths to the raw
run. Avoid verdict packets and workflow language.
