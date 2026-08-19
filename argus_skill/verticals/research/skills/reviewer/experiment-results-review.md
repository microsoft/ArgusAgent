---
name: "Experiment Results Review"
description: "Review experiment results for scientific validity before writing the paper. Check statistical significance, ablation fairness, effect size meaningfulness, and whether results support the intended claims."
---

# Experiment Results Review

Review whether the experiment was engineered correctly and whether its evidence
supports the selected idea's frozen premise. The goal is to catch invalid runs
and unsupported interpretations before they enter downstream claims.

## Reviewer stance
- You are validating an experiment, not repeating upstream idea selection.
- Weak results honestly presented are better than strong results from flawed methodology.
- Treat method reasonableness, originality, and significance as frozen upstream
  decisions. Do not re-rank or re-litigate them from experimental outcomes.
- Check only (1) engineering and protocol validity and (2) whether the valid
  evidence supports, refutes, or leaves unresolved the frozen premise.
- If execution changed the method, premise, comparator, or claim boundary,
  report a fidelity failure and return it upstream; do not repair idea selection
  inside the experiment review.

## When the method did NOT beat the baseline

A loss is a root-cause and research-value decision point.

1. **Audit engineering adequacy.** Inspect source and executed artifacts, not the
   Engineer's confidence. Check reference parity, actual configuration,
   optimization/tuning, model/data capacity, evaluator semantics, fair budgets,
   dropped failures, and diagnostics tied to the proposed mechanism.
2. **Classify the cause:** misconfigured, under-engineered, unfair comparison,
   inconclusive due to insufficient discriminative power, genuine method
   failure, or infeasible under the available resources.
   Before claiming genuine failure, verify that the tasks exercised the proposed
   mechanism, the baseline had metric headroom, and the cases/repeats could
   resolve the predeclared contrast. A ceilinged/floored or underpowered tie is
   inconclusive, not a negative method result.
3. **Recommend the next experimental action by evidence and information gain:**
   - repair or optimize when a concrete credible change could give the idea a
     fairer test;
   - classify the frozen premise as supported, refuted, or inconclusive;
   - return upstream when the method or premise needs revision. Do not choose a
     replacement idea or decide publication value in this review.

There is no fixed number of optimization passes. Stop when credible fixes are
exhausted or no longer worth their cost, not because a retry counter fired.
Preserve all valid evidence internally, but do not force every negative run into
the manuscript.

For an idea that has passed selection, a weak first result cannot route directly
to drafting. Require a concrete post-selection repair cycle when the mechanism
remains plausible: diagnose the cause, improve the method/implementation or test
for a stated scientific reason, and rerun the decisive comparison. Reject any
"improvement" obtained by changing labels, dropping seeds, switching metrics
after inspection, mining slices, weakening baselines, or suppressing evidence
that would alter the headline conclusion.

## Six review dimensions

Score each 1–5. Score 3+ on all dimensions = pass. Here `pass` means the
experiment is engineering-valid and its interpretation is reviewable; it does
not mean the frozen premise was supported. Report that separately as
`idea_status`.

1. **Statistical and evidential support**
   - Is uncertainty handled appropriately for the data-generating process and claim?
   - Are confidence intervals, repeated measurements, sensitivity analyses,
     formal guarantees, or other domain-appropriate support reported?
   - Are small samples scoped honestly rather than rejected by a universal count?

2. **Ablation fairness**
   - Does each ablation isolate exactly one variable?
   - Are comparisons apples-to-apples (same training data, same compute, same hyperparameters)?
   - Is "without component X" implemented as removing X (fair) or as not training X at all (unfair)?
   - Would a reviewer call any comparison misleading?

3. **Effect size and practical significance**
   - Is the observed effect, null, diagnostic pattern, or boundary meaningful for
     the stated research question?
   - Was each numeric pass/fail cutoff justified by utility, risk, a domain
     standard, prior evidence, theory, or prospective sensitivity rather than an
     unsupported round-number target? If no justified cutoff exists, assess the
     continuous estimate, uncertainty, regimes, and cost-quality frontier; merely
     missing an arbitrary target cannot establish method failure.
   - Are there regimes where the contribution helps, fails, or changes interpretation?
   - Are claim-critical null results honestly represented without turning the
     paper into an exhaustive failure log?

4. **Claim support**
   - Do the numbers support the stated evidence conclusion about the frozen
     premise, whether that conclusion is supported, refuted, or inconclusive?
   - Are there overclaims (claiming "significant improvement" for marginal gains)?
   - Are there underclaims (missing an interesting finding in the data)?
   - Is the headline result the strongest honest claim, or is it cherry-picked?

5. **Baseline competitiveness**
   - Did baselines actually run and produce reasonable numbers (not all zeros)?
   - Is there at least one baseline that is competitive (not trivially weak)?
   - Did the baseline leave enough headroom for the comparison to distinguish
     methods, rather than saturating on an easy task slice?
   - Would a reviewer say "this baseline is too weak to be meaningful"?
   - Are published results from prior work included where available?

6. **Completeness**
   - Are all planned conditions/baselines/benchmarks represented in results?
   - Are there missing runs that would change the conclusions?
   - Are error cases and failure modes analyzed where they explain the thesis?

## Output format

Return JSON:
```json
{
  "score": 1-5,
  "pass": true/false,
  "idea_status": "untested|inconclusive|supported|refuted",
  "dimension_scores": {
    "statistical_significance": 1-5,
    "ablation_fairness": 1-5,
    "effect_size": 1-5,
    "claim_support": 1-5,
    "baseline_competitiveness": 1-5,
    "completeness": 1-5
  },
  "issues": ["specific issue 1", "specific issue 2"],
  "verdict": "one sentence on engineering validity and evidence status",
  "claim_recommendations": [
    "Claim X is supported — keep",
    "Claim Y is overclaimed — soften to Z",
    "Finding W is interesting but not claimed — consider adding"
  ]
}
```

## Hard blockers (auto-fail regardless of score)
- No domain-appropriate uncertainty or evidential justification for the headline result
- Unfair ablation: comparing trained component vs untrained/random component
- All baselines at 0% or trivially broken
- A ceilinged/floored or underpowered tie is used to reject the method instead of
  being classified as inconclusive and redesigned
- Headline claim contradicts the actual numbers
- Missing a planned benchmark/condition with no explanation
- Reporting only the best cherry-picked metric while hiding others
- Drafting a selected method's weak result before a credible diagnosis and
  targeted repair, unless the negative finding itself already supports a
  surprising and independently useful thesis
- Results are interpreted against a method, premise, comparator, or claim
  boundary that differs from the frozen selection

## Infrastructure validity
Flag infrastructure only when it invalidates the comparison, measurement, or
claim. Do not reject a custom runtime, small model, CPU path, or unbatched
execution merely because a larger/faster setup was available; those choices may
be the research subject or a controlled design decision.
