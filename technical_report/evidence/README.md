# Reproducibility Materials

This directory contains the machine-readable data used to regenerate the tables
and empirical figures in the Argus technical report.

## Contents

- `website_results.json` contains the public result records summarized in the
  benchmark table, together with their source URLs.
- `paper_inventory.json` contains the de-duplicated public research portfolio used
  for the breadth summary.
- `swebench_pro/` contains the unified 731-task experiment summary, longitudinal
  Wave aggregates, and Reviewer-intervention statistics.
- `erdos_trace/` contains the public mathematical trajectory and aggregate
  role-efficiency measurements used in the vertical case study.
- `process_theory/` contains the numerical substitutions and theory-to-measurement
  mapping used by the process-to-capability analysis.
- `paper_case_study/` contains the public trajectory aggregates for six autonomous
  paper-production campaigns.
- `mle_bench_lite/` records the reviewer-approved MLE-Bench Lite medal campaign:
  nine medals to date, with per-competition scores and the official
  bronze/silver/gold thresholds, reconciled against the 2026-07-29 campaign
  snapshot. The campaign is still running.
- `ace2_chip/` records the ACE-2 inference accelerator certified for its
  demonstrated scope on 2026-08-04: functional closure of the 24-layer, two-token
  Qwen2.5-0.5B W4A8 integration and canonical SKY130 mapped synthesis/OpenSTA.
  Its *What this is not* section lists the certificate's own exclusions and should
  be read before citing any physical-design number.
- `rwkv6_upstream_adoption/` records the report's distinct TileLang RWKV6
  contribution in fla-org PR #1045, merged into `fla-org:main` as commit `c70f11c`.
- `fla_kernel_optimization/` contains the certified GPU-kernel-optimization results
  (the `chunk_kda` op of `flash-linear-attention` on an NVIDIA B200) produced
  autonomously by the `kernel_engineering` vertical, together with the combined source
  diff against the frozen baseline. The performance route was **retired**: fla-org#1054
  was closed without merge after a representative D128 follow-up showed no meaningful
  training gain. The independently reproducible SM100 autotune crash was extracted
  into fla-org#1109, which was maintainer-approved and awaiting merge on 2026-08-07.
  The D64 measurement remains valid but is scoped to one shape on one GPU generation.
  This is a later, separate case from RWKV6 PR #1045. See that directory's
  *Upstream status* before citing it.

The report build uses only the fields required by the published tables and
figures. Credentials, private model reasoning, and raw runtime event streams are
not included. Source-specific regeneration instructions are provided in each
subdirectory.

Run `make all` from `technical_report/` to rebuild the paper and its generated
figures.
