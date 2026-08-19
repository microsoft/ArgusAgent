"""Research-vertical stage definitions and checklists.

Authoritative location for the 8 paper-pipeline stages
(research → plan → benchmark → run → analysis → draft → review →
submission), the per-stage markdown ``CHECKLIST_ITEMS`` the L2 Reviewer
certifies against, and the venue-specific checklist rendering.

This module is the **vertical-specific** half of the stage system. Future
verticals define their own ``stages.py`` with their own stage list and
checklist items.
"""
from __future__ import annotations

from pathlib import Path

from ...skills.stage_machine import ChecklistItem
from . import library_preparation
from .prompt_policy import render_role_prompt_fragment
from .venue_profiles import VenueProfile, resolve_venue_profile

LIBRARY_PREPARER = library_preparation.prepare_skill_libraries

CANONICAL_STAGE_ORDER: tuple[str, ...] = (
    "research",
    "plan",
    "benchmark",
    "run",
    "analysis",
    "draft",
    "review",
    "submission",
)


def _checklist(*items: ChecklistItem) -> tuple[ChecklistItem, ...]:
    return tuple(items)


STAGE_CHECKLISTS: dict[str, tuple[ChecklistItem, ...]] = {
    "research": _checklist(
        ChecklistItem(
            id="research.literature",
            statement=(
                "The canonical literature ledger covers the claims the project "
                "actually depends on: the nearest competing methods, the relevant "
                "AI-venue/recent-arXiv frontier, lineage/classic foundations, "
                "contradictory evidence, and unresolved frontier. The Reviewer flags "
                "source-mix imbalance as an advisory risk, not a fixed quota or "
                "completion blocker. Each retained source has a verifiable primary URL "
                "and project implication; judge connected coverage and documented "
                "limitations, not category counts."
            ),
            evidence_hint=(
                "research/LITERATURE_GROUNDING.json (canonical); "
                "research/LIT_MATRIX.tsv is generated with "
                "`python -m argus_skill.verticals.research.literature_ledger sync`"
            ),
        ),
        ChecklistItem(
            id="research.idea_portfolio",
            statement=(
                "A 12-route team explores concurrently; each result gets an independent "
                "review, and a fresh selector acts at the 80% review quorum without "
                "waiting for the final routes."
            ),
            evidence_hint=(
                "research/IDEA_PORTFOLIO.json + research/ideation/portfolios/**/"
                "{routes,reviews,probes} + team tasks/shards"
            ),
        ),
        ChecklistItem(
            id="research.adversarial_selection",
            statement=(
                "After at least 80% of reviews (10/12 by default), a fresh Agent selects "
                "qualitatively by theory, novelty, generality, and top-conference "
                "potential. Probe metrics cannot veto the choice; final routes do not "
                "block planning."
            ),
            evidence_hint=(
                "research/IDEA_SELECTION.json + selected route/review/EVIDENCE.json"
            ),
        ),
        ChecklistItem(
            id="research.brief",
            statement=(
                "A research brief frames the problem, the gap in prior work, and "
                "the proposed direction in citation-grounded prose."
            ),
            evidence_hint="research/RESEARCH_BRIEF.md",
        ),
        ChecklistItem(
            id="research.thesis",
            statement=(
                "The selected thesis has a plausible nontrivial technical core, "
                "originality, formal/causal structure, field-level potential, and an "
                "evidence path. Research review is qualitative: no finished theorem, "
                "fixed implementation, or reliable effect size is required. Reject only "
                "clear duplicates, trivial prompt/schema/wrapper/scale variants, "
                "incoherent mechanisms, or decorative math. Before any probe is designed "
                "or executed, lock method reasonableness; the thesis may evolve later."
            ),
            evidence_hint=(
                "research/RESEARCH_BRIEF.md and research/ideation/{routes,debates}/"
            ),
        ),
        ChecklistItem(
            id="research.signal_derisk",
            statement=(
                "Only after research.thesis has qualitatively admitted a candidate, "
                "run one REAL advisory probe, normally <=10 minutes / <=$1; never run "
                "the formal benchmark, training, broad sweep, or publication-scale "
                "multi-seed study. The Planner authors the evidence contract. Preserve "
                "commands/raw outputs and record untested/inconclusive/supported/refuted "
                "honestly. The probe cannot kill or block a qualified idea or become a "
                "mechanical routing decision: infrastructure/implementation failures, "
                "baseline ceiling/floor saturation, and missing predeclared power and "
                "headroom are limitations. Later stages own decisive benchmarks. "
                "`argus_skill.verticals.research.signal_derisk validate` is available "
                "only for "
                "the default scalar-comparison shape and never decides quality."
            ),
            evidence_hint=(
                "Planner-authored research.signal_derisk evidence paths; for the "
                "default scalar shape use research/SIGNAL_DERISK.json + raw log; "
                "verdict in research/ideas/<id>/EVIDENCE.json, checked by "
                "`...verticals.research.idea_evidence check`"
            ),
        ),
    ),
    "plan": _checklist(
        ChecklistItem(
            id="plan.experiment",
            statement=(
                "Experiment plan states the hypothesis, the proposed method, the "
                "baselines (including the strongest feasible prior work), the "
                "ablations, the metrics, the interpretation and stopping criteria, "
                "and the compute / API budget. Numeric keep/reject cutoffs require "
                "an external utility, risk, domain-standard, prior-evidence, theory, "
                "or prospective-sensitivity basis; unsupported round-number gains "
                "must not become binary gates."
            ),
            evidence_hint="research/EXPERIMENT_PLAN.md",
        ),
        ChecklistItem(
            id="plan.benchmark",
            statement=(
                "The evaluation-source and comparator plan matches the empirical "
                "domain. Every final empirical claim includes at least one "
                "appropriate public benchmark, dataset, task suite, challenge, or "
                "official evaluation release with URL, version, license/access, "
                "evaluation unit, metric, and claim tested. The number of public "
                "sources, tasks, models, and repeats is justified by the claim scope "
                "and uncertainty method rather than a universal quota. "
                "Clinical or mechanism projects instead enumerate every real public "
                "data source, comparator/control, and planned cohort, including "
                "source URL (or the prospective registry plan), license/access "
                "conditions, observed or planned scale, implementation status, and "
                "the evidence ceiling. Unimplemented cohorts must be labeled "
                "planned with task_count=0; participant visits or nights must never "
                "be relabeled as benchmark tasks."
            ),
            evidence_hint="research/BASELINE_AND_BENCHMARK_PLAN.md, experiments/BENCHMARK_PROVENANCE.json",
        ),
        ChecklistItem(
            id="plan.code_reuse",
            statement=(
                "Code-reuse plan lists every external repo we will run, fork, or "
                "extract from, with what we will reuse vs reimplement."
            ),
            evidence_hint="research/CODE_REUSE_PLAN.json or .md",
        ),
        ChecklistItem(
            id="plan.infra_choice",
            statement=(
                "If training or large-scale inference is required, a final "
                "training-infra and inference-infra choice is locked in after the "
                "idea survives research de-risk. Compare only credible candidates "
                "that materially differ for this workload; reuse previously "
                "certified framework evidence when current. Clone and inspect the "
                "chosen framework and any code-critical comparator, not an arbitrary "
                "quota. The choice must be maintained, open-source, non-trivial, and "
                "compatible with the method and resource budget; record the decisive "
                "tradeoff and one rejected alternative. Do not write a custom "
                "trainer/inference stub when a suitable maintained framework exists."
            ),
            evidence_hint=(
                "research/INFRA_CHOICE.md (short comparison + final choice) + "
                "research/EXPERIMENT_PLAN.md `## Infra` + chosen repo evidence"
            ),
        ),
    ),
    "benchmark": _checklist(
        ChecklistItem(
            id="benchmark.environment_preflight",
            statement=(
                "Before the first real evidence-producing call, the engineer ran the "
                "Environment Readiness Gate (`argus_builtin_skills/engineer/"
                "environment-readiness-gate.md`) and captured the verbatim "
                "output to `experiments/runs/<run_id>/preflight.txt`. The "
                "preflight verifies only resources the experiment actually uses: "
                "the declared project environment, required framework/compiler "
                "imports, public data access, evaluator availability, storage, and "
                "the selected compute backend. CUDA, HF caches, model weights, or API "
                "routes are required only when the run uses them. No applicable "
                "preflight evidence means downstream benchmark items remain open."
            ),
            evidence_hint="experiments/runs/<run_id>/preflight.txt",
        ),
        ChecklistItem(
            id="benchmark.tasks",
            statement=(
                "Each selected public evidence source has a reproducible loader or "
                "retrieval path and its official labels, outcomes, evaluator, or "
                "analysis semantics. Locally generated diagnostics are clearly "
                "separated and never presented as the public benchmark."
            ),
            evidence_hint="public benchmark/data manifest + loader/evaluator",
        ),
        ChecklistItem(
            id="benchmark.provenance",
            statement=(
                "One canonical machine-readable benchmark provenance record lists "
                "every selected public source with "
                "version/date, license/access, split or cohort, evaluation unit, "
                "metric/evaluator, filtering, claim tested, and execution-readiness. "
                "Coverage breadth is justified by the claim. Markdown may be a "
                "generated view, but duplicate prose is not a separate gate."
            ),
            evidence_hint="experiments/BENCHMARK_PROVENANCE.json (canonical)",
        ),
        ChecklistItem(
            id="benchmark.smoke",
            statement=(
                "A faithful smoke run produced real evidence through each distinct "
                "evaluation path that the main experiment depends on."
            ),
            evidence_hint="experiments/**/smoke/*.jsonl",
        ),
        ChecklistItem(
            id="benchmark.evaluator_authentic",
            statement=(
                "The evaluation or analysis implementation is authentic for the "
                "project's empirical domain, not a stub or success-shaped oracle. "
                "For computational benchmarks, inspect that it loads actual outputs "
                "and calls the official scorer/metric rather than returning a "
                "constant. For clinical or mechanism projects, inspect that the "
                "pipeline loads the cited public source records, constructs the "
                "prespecified observation-level outcome, retains exclusions and "
                "failures, and computes the reported estimate and uncertainty from "
                "those records. Candidate and baseline prediction paths cannot read "
                "gold labels, expected outcomes, or scorer-derived fields; removing "
                "or permuting hidden labels must not change predictions. Online "
                "intervention claims require executable comparisons with the same "
                "decision-time information, not only historical traces or post-hoc "
                "judges. Never invent an evaluator, gold label, participant, visit, "
                "or task merely to satisfy this item."
            ),
            evidence_hint=(
                "computational: evaluator source + official scorer outputs; "
                "clinical/mechanism: public-source loader/analysis code + derived "
                "rows + machine-readable result and uncertainty"
            ),
        ),
    ),
    "run": _checklist(
        ChecklistItem(
            id="run.environment_preflight",
            statement=(
                "Each pilot/full/ablation launch has a fresh, run-specific "
                "Environment Readiness Gate transcript. Verify only resources that "
                "run actually uses (environment, data/evaluator, storage, GPU/model/API "
                "as applicable); an applicable failed or missing preflight means the "
                "run is uncertified."
            ),
            evidence_hint="experiments/runs/<run_id>/preflight.txt (per run)",
        ),
        ChecklistItem(
            id="run.manifests",
            statement=(
                "Each long-running experiment writes manifest.json, status.json, "
                "progress.jsonl, raw scored rows, and obeys the STOP-file "
                "cancellation contract."
            ),
            evidence_hint="experiments/<run>/{manifest,status}.json + progress.jsonl + raw rows",
        ),
        ChecklistItem(
            id="run.matrix",
            statement=(
                "The proposed contribution, strongest relevant comparisons, and "
                "claim-critical controls/ablations have completed on the selected "
                "public evidence sources, or have explicit evidence-backed "
                "exclusions."
            ),
            evidence_hint="experiments/**/scored.jsonl across all method × family cells",
        ),
        ChecklistItem(
            id="run.scale",
            statement=(
                "Final empirical claims include executed public benchmark/data "
                "evidence at a scale justified by the claim and uncertainty method. "
                "Synthetic/generated diagnostics are labeled supplementary and are "
                "not the sole final evidence."
            ),
            evidence_hint="experiments/**/manifest.json declares scale=full",
        ),
        ChecklistItem(
            id="run.score_variance",
            statement=(
                "Spot-check scored rows per evidence family. A file with >3 rows "
                "and one identical score throughout is stub evidence unless the "
                "official task genuinely permits that outcome; require the authentic "
                "scorer before completing run."
            ),
            evidence_hint=(
                "`python -m argus_skill.verticals.research.integrity_check scores` "
                "fails on any scored_rows.jsonl whose scorer returned one value"
            ),
        ),
        ChecklistItem(
            id="run.method_diagnosis_recall",
            statement=(
                "Before calling an underperforming idea a scientific failure, audit "
                "whether the implementation is faithful and competitive: compare "
                "against trusted reference behavior, inspect actual executed knobs "
                "and loaded checkpoint identity/capability when relevant, inspect "
                "evaluator semantics, diagnose optimization/tuning/capacity/data "
                "limits, and test concrete plausible repairs when their information "
                "gain justifies the cost. Classify the outcome as misconfigured, "
                "under-engineered, genuine method failure, or infeasible. Do not use "
                "a fixed retry count, generic extra scale, or passing unit tests as a "
                "substitute for this diagnosis."
            ),
            evidence_hint=(
                "reference reproduction + implementation source + executed manifests "
                "+ diagnostics + targeted repair results; use the matched diagnosis skill"
            ),
        ),
    ),
    "analysis": _checklist(
        ChecklistItem(
            id="analysis.claims",
            statement=(
                "Every quantified claim the paper will make is bound to its "
                "supporting raw evidence rows and to the figure / table that will "
                "show it."
            ),
            evidence_hint=(
                "paper/claims_to_evidence.tsv + result tables/figures + canonical "
                "raw outputs"
            ),
        ),
        ChecklistItem(
            id="analysis.report",
            statement=(
                "Results report summarizes headline numbers, statistical tests / "
                "confidence intervals, ablation findings, and failure analysis "
                "with numbers grounded in raw experiment files."
            ),
            evidence_hint="paper/RESULTS_REPORT.md",
        ),
        ChecklistItem(
            id="analysis.gaps",
            statement=(
                "Known evidence gaps are explicitly enumerated with a planned "
                "supplement, ablation, or claim downgrade — no missing evidence "
                "is silently absorbed."
            ),
            evidence_hint="paper/main.tex limitations + Reviewer notes + raw results",
        ),
        ChecklistItem(
            id="analysis.thesis",
            statement=(
                "The evidence supports one defensible, venue-relevant thesis. Internal "
                "records preserve all valid outcomes, but the proposed paper is a "
                "selective argument: it leads with the strongest valid evidence for the "
                "thesis, retains claim-critical contrary evidence, and keeps "
                "misconfigured runs, exploratory dead ends, and secondary diagnostics "
                "in audit artifacts or an appendix rather than dumping them into the "
                "main narrative. A selected idea with a plausible mechanism receives "
                "credible targeted repair before weak results are reframed for a paper. "
                "If no strong thesis survives, return to implementation, experiments, "
                "or research/plan instead of drafting."
            ),
            evidence_hint="paper/main.tex + canonical raw evidence + Reviewer judgment",
        ),
    ),
    "draft": _checklist(
        ChecklistItem(
            id="draft.tex",
            statement=(
                "paper/main.tex uses the selected venue's official structure and tells "
                "one coherent argument, not a chronological experiment report. The "
                "title, abstract, introduction, method, and experiments all serve the "
                "same thesis; the paper does not introduce "
                "a method as its contribution and then make that method's failure the "
                "main conclusion without an independently valuable insight. A "
                "literature review instead aligns its scope, taxonomy/comparison "
                "frame, source evidence, synthesis, limitations, and conclusions; it "
                "must not invent a method or experiment section merely to mimic an "
                "empirical paper."
            ),
            evidence_hint="paper/main.tex + research/VENUE_PROFILE.json + research/NARRATIVE_REPORT.md",
        ),
        ChecklistItem(
            id="draft.pdf",
            statement=(
                "paper/main.pdf compiles cleanly: no '??' citations, no undefined "
                "references, no material overflow, and no LaTeX errors. Its body and "
                "back matter obey the selected venue's actual page and format rules; "
                "do not pad a weak argument merely to fill a page quota."
            ),
            evidence_hint="paper/main.pdf + paper/main.log",
        ),
        ChecklistItem(
            id="draft.bibliography",
            statement=(
                "Every BibTeX entry is verified through a scholarly source (arXiv, "
                "ACL Anthology, DBLP, CrossRef, Semantic Scholar) — none invented "
                "or auto-completed."
            ),
            evidence_hint=(
                "paper/references.bib + verification log; resolve mechanically "
                "with `python -m argus_skill.verticals.research.integrity_check "
                "citations`"
            ),
        ),
        ChecklistItem(
            id="draft.figures",
            statement=(
                "The paper's figures are clear, readable at final size, visually "
                "coherent, and attractive enough for the venue. Use a good-enough "
                "standard: minor stylistic imperfections are not blockers, and do "
                "not request repeated regeneration unless a figure is unreadable, "
                "factually wrong, visibly broken, or seriously harms the paper."
            ),
            evidence_hint=(
                "paper/main.pdf rendered pages and the actual figure files; optional "
                "FIGURE_PROVENANCE.json may help locate the source renderer"
            ),
        ),
    ),
    "review": _checklist(
        ChecklistItem(
            id="review.infrastructure",
            statement=(
                "Paper prose contains no local paths (/root/, /home/), no internal "
                "orchestration or daemon route names, no capability-vault references, no "
                "device IDs, no API keys — the manuscript is publication-clean."
            ),
            evidence_hint="grep main.tex for '/root/', 'CUDA_VISIBLE_DEVICES', 'argus-skill', 'codex', 'OPENAI_API_KEY'",
        ),
        ChecklistItem(
            id="review.placeholders",
            statement=(
                "No PLACEHOLDER / TODO / TBD / FIXME / UNVERIFIED markers in the "
                "paper body, captions, or tables."
            ),
            evidence_hint="grep -nE 'PLACEHOLDER|TODO|TBD|FIXME|UNVERIFIED' paper/main.tex",
        ),
        ChecklistItem(
            id="review.tables",
            statement=(
                "Tables are readable and organized around the paper's claims. They "
                "include every comparison needed to assess the thesis, but do not "
                "force an irrelevant cross-benchmark matrix or a universal house style."
            ),
            evidence_hint="paper/main.tex tables + canonical result artifacts",
        ),
        ChecklistItem(
            id="review.citations",
            statement=(
                "Each related-work paragraph cites the specific papers it "
                "discusses; no mega-paragraphs dumping all citations, no "
                "citations buried in the bibliography with no local discussion."
            ),
            evidence_hint="paper/main.tex Related Work section",
        ),
        ChecklistItem(
            id="review.language",
            statement=(
                "Academic prose reads like a real selected-venue paper, not generic agent "
                "output: the Abstract states problem, gap, article approach, evidence, and "
                "implication (no result-first opening, no validator-checklist "
                "phrasing); the Introduction grounds the gap in cited prior work, "
                "then gives the organizing insight and contribution roadmap. For an "
                "empirical article, Method/Setup identifies the system, baselines, "
                "task source, metrics, backend, budget, and result preview. For a "
                "literature review, the scope/method explains source selection and "
                "the body provides a defensible taxonomy, fair comparisons, conflicts, "
                "gaps, and limitations. Every "
                "headline claim is tied to reported evidence; no unsupported hype, "
                "template LLM openings, experiment-report narration, or repeated "
                "not-X-but-Y caveats. Limitations bound the thesis instead of becoming "
                "the paper's central message. The "
                "model-backed reviewer (academic_language_review) is advisory "
                "input — this checklist, judged by the reviewer agent, is the "
                "source of truth."
            ),
            evidence_hint="paper/main.tex Abstract/Introduction/Method + paper/ACADEMIC_LANGUAGE_REVIEW.json (advisory)",
        ),
        ChecklistItem(
            id="review.publication_value",
            statement=(
                "As a venue reviewer, identify the strongest accept argument before "
                "passing. A valid experiment, transparent failure report, or complete "
                "artifact bundle is not enough. Original research must deliver a clear "
                "insight, method/system, theorem, or decision-relevant boundary. A "
                "weak result cannot be rescued by renaming it a diagnostic. A "
                "literature review must deliver valuable coverage, synthesis, critique, "
                "and a defensible map of the field rather than a paper-by-paper list."
            ),
            evidence_hint="paper/main.tex + paper/main.pdf + canonical evidence",
        ),
    ),
    "submission": _checklist(
        ChecklistItem(
            id="submission.upstream",
            statement=(
                "All upstream stage checklists (research → review) are themselves "
                "marked done by a prior reviewer round or explicitly skipped by a "
                "recorded Manager decision because they do not apply to this article "
                "form. Submission readiness is not a way to retro-fix missing evidence."
            ),
            evidence_hint=(
                ".argus/PIPELINE_STATE.json shows each stage status=done or "
                "status=skipped with skip_reason/skipped_by and stage_history evidence"
            ),
        ),
        ChecklistItem(
            id="submission.readiness",
            statement=(
                "The independent Reviewer has read the current manuscript and its "
                "claim-critical sources and judges the paper ready for the selected "
                "venue. No separate assurance memo or evidence package is required."
            ),
            evidence_hint="paper/main.tex + paper/main.pdf + canonical results and sources",
        ),
        ChecklistItem(
            id="submission.package",
            statement=(
                "Final PDF, BibTeX, supplementary material, and (if required) "
                "anonymous submission packaging are present and consistent."
            ),
            evidence_hint="paper/main.pdf + paper/references.bib + paper/supplementary/",
        ),
        ChecklistItem(
            id="submission.anonymous",
            statement=(
                "The compiled PDF uses the selected venue's required author and "
                "anonymity mode without contradictory or placeholder metadata."
            ),
            evidence_hint="paper/main.tex author block + selected venue submission mode",
        ),
    ),
}


def list_stages() -> tuple[str, ...]:
    """Return the canonical stage order (research → submission)."""

    return CANONICAL_STAGE_ORDER


def get_stage_checklist(stage: str) -> tuple[ChecklistItem, ...]:
    """Return the checklist items for ``stage``; empty tuple if unknown."""

    return STAGE_CHECKLISTS.get(str(stage).strip().lower(), ())


def stage_completion_issues(stage: str, project_root: Path) -> tuple[str, ...]:
    if str(stage or "").strip().lower() != "research":
        return ()
    from .idea_portfolio import idea_portfolio_completion_issues

    return idea_portfolio_completion_issues(project_root)



RESEARCH_TARGET_LEVELS = ("exploratory", "publishable", "doctoral")

STAGE_ORDER = [
    "research", "plan", "benchmark", "run",
    "analysis", "draft", "review", "submission",
]


def _resolve_checklist_venue(project_root) -> VenueProfile:
    """Resolve the venue profile for checklist rendering.

    ``project_root`` may be None (resolved from env/cwd, matching how the
    overlay locates the project). Missing or unknown venue selection propagates
    ``KeyError`` so it cannot be silently certified against unrelated rules.
    """
    import os

    if project_root is None:
        project_root = os.environ.get("ARGUS_SKILL_PROJECT_ROOT") or "."
    return resolve_venue_profile(Path(project_root))


VENUE_DEPENDENT_STAGES = frozenset({"draft", "review", "submission"})


def _unresolved_venue_checklist(
    header: str,
    *,
    role: str,
    error: KeyError,
) -> str:
    """Render a fail-closed venue gate without crashing prompt construction."""
    if role == "reviewer":
        instruction = (
            "Keep this item unchecked and do not return `done`; ask the engineer "
            "to resolve it in `next_action`."
        )
    else:
        instruction = (
            "Resolve this item before doing venue-specific drafting, review, or "
            "submission work."
        )
    return (
        f"{header}\n\n"
        "### venue resolution\n"
        f"- [ ] `venue.profile` — {error}. `target_venue` must name a real "
        "publication venue, not planning commentary. If no venue was specified, "
        "do not infer or search for one; ask the operator to name a venue or "
        "explicitly request venue discovery. For an explicit venue, record its "
        "official CFP/deadline evidence in `research/VENUE_SELECTION.md` and write "
        "`research/VENUE_PROFILE.json` from its official author kit. "
        f"{instruction}"
    )


def _apply_venue_to_checklist_body(body: str, venue: VenueProfile) -> str:
    """Render the generic paper floor with the selected venue's real rules."""
    persona = venue.reviewer_persona
    page_phrase = (
        (
            f"up to {venue.body_page_limit} pages, References starts on "
            f"page {venue.references_min_page} or later"
        )
        if venue.has_fixed_page_budget
        else venue.page_budget_line()
    )
    section_label = (
        f"{venue.display_name} two-column paper sections"
        if venue.layout_format_persona.startswith("two-column")
        else f"{venue.display_name} journal-article sections"
    )
    body = body.replace(
        "paper/main.tex uses the selected venue's official structure",
        f"paper/main.tex uses the official {section_label}",
    )
    body = body.replace(
        "Its body and back matter obey the selected venue's actual page and "
        "format rules",
        f"Its body and back matter obey {page_phrase}",
    )
    body = body.replace(
        "The title, abstract, introduction, method, and experiments all serve "
        "the same thesis;",
        f"Required venue end matter: {venue.draft_section_tail()}. The title, "
        "abstract, introduction, method, and experiments all serve the same thesis;",
    )
    if venue.key == "FRONTIERS_SLEEP":
        replacements = {
            (
                "paper/main.tex uses the official Frontiers in Sleep journal-article "
                "sections and tells one coherent argument"
            ): (
                "paper/main.tex uses the Frontiers in Sleep Hypothesis and "
                "Theory sections in a coherent order: one-paragraph Abstract, "
                "Introduction, subject-relevant evidence and theory subsections, "
                "discriminating tests or proposed study, Discussion, Conclusion, "
                "required declarations, and References. The article tells one "
                "coherent argument"
            ),
            (
                "Every BibTeX entry is verified through a scholarly source (arXiv, "
                "ACL Anthology, DBLP, CrossRef, Semantic Scholar) — none invented "
                "or auto-completed."
            ): (
                "Every BibTeX entry is verified through a scholarly or canonical "
                "data source (for example PubMed, Crossref, DOI resolver, or the "
                "official repository); none is invented or auto-completed."
            ),
            (
                "Paper prose contains no local paths (/root/, /home/), no internal "
                "orchestration or daemon route names, no capability-vault references, no "
                "device IDs, no API keys — the manuscript is publication-clean."
            ): (
                "Paper prose contains no local paths, credentials, capability-vault "
                "references, device IDs, private routes, daemons, or internal "
                "reviewer/engineer workflow labels. Any generative-AI use is "
                "disclosed only in the public Frontiers-required form (technology "
                "name, version, model, source, use, and author responsibility)."
            ),
            (
                "Each related-work paragraph cites the specific papers it discusses; "
                "no mega-paragraphs dumping all citations, no citations buried in "
                "the bibliography with no local discussion."
            ): (
                "Each evidence or prior-theory paragraph cites the specific papers "
                "it discusses; no citation dumping and no bibliography entries "
                "without a reader-facing role in the manuscript."
            ),
            (
                "Final PDF, BibTeX, supplementary material, and (if required) "
                "anonymous submission packaging are present and consistent."
            ): (
                "Final PDF, TEX/BibTeX sources, figures with alt text, supplementary "
                "audit material, and required single-anonymized author/declaration "
                "metadata are present and mutually consistent."
            ),
            "paper/references.bib + verification log": (
                "paper/refs.bib (or declared bibliography source) + verification log"
            ),
            "paper/main.tex table* envs + caption": (
                "paper/main.tex table environments + captions + canonical evidence"
            ),
            "paper/main.tex Related Work section": (
                "paper/main.tex evidence/prior-theory sections"
            ),
            "paper/main.tex Abstract/Introduction/Method + "
            "paper/ACADEMIC_LANGUAGE_REVIEW.json (advisory)": (
                "paper/main.tex Abstract/Introduction/theory/evidence/Discussion + "
                "paper/ACADEMIC_LANGUAGE_REVIEW.json (advisory)"
            ),
        }
        for old, new in replacements.items():
            body = body.replace(old, new)
        body = body.replace(
            "irrelevant cross-benchmark matrix",
            "irrelevant omnibus benchmark matrix",
        )
        body = body.replace(
            "Academic prose reads like a real EMNLP paper, not generic agent output:",
            "Academic prose reads like a real Frontiers in Sleep Hypothesis and "
            "Theory article:",
        )
        body = body.replace(
            "the Method/Setup lets an outside reviewer identify the evaluated system, "
            "baselines, task source, metrics, evaluated model/backend, and budget;",
            "the body separates prior theory, original analysis, interpretation, "
            "alternatives, falsifiers, and planned work;",
        )
    generic_author_rule = (
        "The compiled PDF uses the selected venue's required author and "
        "anonymity mode without contradictory or placeholder metadata."
    )
    generic_author_evidence = (
        "paper/main.tex author block + selected venue submission mode"
    )
    if venue.requires_real_author_metadata:
        body = body.replace(
            generic_author_rule,
            "The compiled PDF and source use the real author names, affiliations, "
            "corresponding-author email, and required contribution metadata for "
            f"{venue.review_model} {venue.display_name} review; no anonymous "
            "placeholder remains.",
        )
        body = body.replace(
            generic_author_evidence,
            "paper/main.tex author/address/correspondence/contribution fields + "
            "compiled PDF metadata",
        )
    else:
        body = body.replace(
            generic_author_rule,
            f"Anonymous submission for {venue.display_name}: the compiled PDF uses "
            f"the {persona} author block without real author names, affiliations, "
            "or self-deanonymizing strings.",
        )
        body = body.replace(
            generic_author_evidence,
            f"grep paper/main.tex for '{venue.anon_author_string}' + "
            f"{venue.style_package} submission mode",
        )
    substitutions = {
        "reads like a real selected-venue paper": f"reads like a real {persona} paper",
    }
    for old, new in substitutions.items():
        body = body.replace(old, new)
    return body


def render_stage_checklist_body(
    body: str,
    *,
    project_root,
    role: str,
    stage: str,
) -> str:
    if stage not in VENUE_DEPENDENT_STAGES:
        return body
    try:
        return _apply_venue_to_checklist_body(
            body,
            _resolve_checklist_venue(project_root),
        )
    except KeyError as exc:
        return body + "\n\n" + _unresolved_venue_checklist(
            "## Venue selection",
            role=role,
            error=exc,
        )


def render_full_checklist_body(
    body: str,
    *,
    project_root,
    role: str,
) -> str:
    try:
        return _apply_venue_to_checklist_body(
            body,
            _resolve_checklist_venue(project_root),
        )
    except KeyError as exc:
        return body + "\n\n" + _unresolved_venue_checklist(
            "## Venue selection",
            role=role,
            error=exc,
        )


# ===========================================================================
# System (B) — markdown stage checklists for the research vertical
# ===========================================================================
#
# Research owns its stage order, checklist seeds, and venue-specific rendering.
CHECKLIST_STAGE_ORDER = CANONICAL_STAGE_ORDER
CHECKLIST_ITEMS = STAGE_CHECKLISTS

#: Research missions complete on the selected venue's full-paper submission gate.
completion_gate = "certified"
MISSION_KIND = "research"
PAPER_MISSION = True

# Research proceeds through strict stage gates, but evidence reuse within those
# stages is proportional: once a Reviewer certifies a source or artifact, later
# bounded missions verify only the new claim/delta unless a concrete conflict
# reopens it. This keeps scientific integrity without repeatedly rebuilding the
# same provenance tree.
WORKFLOW_MODE = "proportional"
VERIFICATION_STAGE_PROFILES = {
    "research": "explore",
    "plan": "explore",
    "benchmark": "develop",
    "run": "develop",
    "analysis": "develop",
    "draft": "develop",
    "review": "certify",
    "submission": "certify",
}

# Scientific implementation and experiment claims always require a fresh,
# independent Reviewer; an Engineer verifier cannot waive this review.
REQUIRE_INDEPENDENT_REVIEW = True

_REVIEWER_ENGINEERING_AUDIT = (
    "For experiment claims, inspect implementation and raw rows once, then reuse "
    "them until a dependency changes. Separate method results from infrastructure "
    "or evaluator failure. Research-stage smoke probes are short advisory "
    "observations, not miniature benchmarks or idea-kill gates: judge the idea "
    "primarily from theory, novelty, mechanism, generality, and professional "
    "plausibility. Weak, null, noisy, underpowered, misconfigured, or inconclusive "
    "smoke results cannot by themselves trigger replan or reject a review-qualified "
    "idea; record limitations for later iterative engineering. Source-mix imbalance "
    "between AI-frontier and foundational work is advisory, never a quota.\n"
)

_PLANNER_RESEARCH_ORCHESTRATION = (
    "Research orchestration: run routes and reviews concurrently. At an 80% review "
    "quorum (10/12 by default), let a fresh selector Agent choose qualitatively by "
    "theory, novelty, generality, top-conference shape, and evidence path; do not "
    "wait for the final routes. Probe only that winner with one advisory observation "
    "normally below ten minutes; never use a full benchmark, training run, broad "
    "sweep, or publication-scale multi-seed study as a research probe. The smoke "
    "result cannot kill or block the selected idea. Keep the resulting critical path "
    "below one hour when default resources allow it. A failed hypothesis or rejected "
    "direction is project memory, not automatic completion or a forced next action; "
    "only the independently reviewed research target closes the project.\n"
)

_ENGINEER_RESEARCH_EXECUTION = (
    "Research execution: keep independent work file-disjoint and parallel. Respect "
    "the route/review/selector/probe time boxes, stop searching once the novelty "
    "boundary is credible, and treat source-balance gaps and smoke outcomes as "
    "documented limitations rather than reasons to stall.\n"
)


def role_banner(role: str = "engineer") -> str:
    """Add research-only role policy without affecting other verticals."""
    return {
        "planner": _PLANNER_RESEARCH_ORCHESTRATION,
        "reviewer": _REVIEWER_ENGINEERING_AUDIT,
        "engineer": _ENGINEER_RESEARCH_EXECUTION,
    }.get(role, "")


__all__ = [
    "STAGE_ORDER",
    "CANONICAL_STAGE_ORDER",
    "STAGE_CHECKLISTS",
    "list_stages",
    "get_stage_checklist",
    "VENUE_DEPENDENT_STAGES",
    "render_stage_checklist_body",
    "render_full_checklist_body",
    "CHECKLIST_STAGE_ORDER",
    "CHECKLIST_ITEMS",
    "WORKFLOW_MODE",
    "VERIFICATION_STAGE_PROFILES",
    "REQUIRE_INDEPENDENT_REVIEW",
    "role_banner",
    "render_role_prompt_fragment",
    "stage_completion_issues",
    "completion_gate",
    "PAPER_MISSION",
]
