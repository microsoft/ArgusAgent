# FLA Kernel Optimization — Argus `kernel_engineering` vertical case study

Autonomous GPU-kernel-optimization case study. Argus's `kernel_engineering` vertical
optimized the **`chunk_kda`** (Kimi Delta Attention) kernels in
[`fla-org/flash-linear-attention`](https://github.com/fla-org/flash-linear-attention)
on an **NVIDIA B200 (sm_100)**, reaching **+17.66%** certified at N>=10 and **+29.93%**
on a single combined verification run, at `B8_T1024_H8_D64` — correctness-preserving and
memory-neutral against a frozen baseline.

Argus performed the profiling, hypothesis, kernel implementation, benchmarking, and
independent certification autonomously; the operator only supplied the objective and
re-derived every speedup from the raw `score.json`.

**Status: the D64 measurement remains valid, but the performance route was retired.**
[fla-org#1054](https://github.com/fla-org/flash-linear-attention/pull/1054) was closed
without merge after representative D128 follow-up showed no meaningful training gain.
The independently reproducible SM100 autotune crash was extracted into focused PR
[fla-org#1109](https://github.com/fla-org/flash-linear-attention/pull/1109), which was
maintainer-approved and awaiting merge on 2026-08-07. Read
*[Upstream status](#upstream-status)* before citing any number here — the original
speedups are measured honestly, but their scope is one shape on one GPU generation.

## Setup

- **Op / shape:** `chunk_kda`, `B8_T1024_H8_D64` (D64), bf16, forward and forward+backward.
- **Baseline:** flash-linear-attention @ `ccb0ff94` (frozen, immutable).
- **Hardware:** NVIDIA B200 (sm_100).
- **Measurement:** frozen paired baseline-vs-candidate evaluator (SHA-pinned scorer);
  `geomean_speedup = baseline_latency / candidate_latency`; peak memory as `max_mem_ratio`;
  atol 1e-2 / rtol 2e-2. Baseline and candidate are measured together on the same GPU so
  shared platform noise cancels in the ratio.
- **Certification bar:** correctness PASS + 0 CUDA errors + memory-neutral (`max_mem_ratio <= 1.00`)
  + N>=10 paired repeats + median geomean >= 1.05, with a cleared-cache repeat.

## Certified optimizations

Each optimization was independently certified vs `ccb0ff94` (numbers in `certified_results.json`):

1. **Paired q/k L2-norm fusion (forward + backward)** — the baseline issues two separate `l2norm`
   launches (q, k) in each direction; this fuses each pair into one kernel, halving launches and HBM
   traffic for the normalization step. **N=10 median +5.6%** (independent re-verification +8.1%).
2. **Inter-solve recompute-epilogue fusion** — `chunk_kda_fwd_kernel_inter_solve_fused` already holds
   the solved `Akk` in registers; computing `w/u/kg` in an epilogue removes the separate
   `recompute_w_u_fwd_kda_kernel` launch and its `Akk` HBM reload. **N=10 median +7.27%** (cold-cache +8.8%).
3. **Cumsum-into-intra producer fusion** — the chunk-local cumulative gate `g` is computed inside the
   intra-subchunk producer instead of a standalone `chunk_local_cumsum_vector_kernel` launch, stored
   once for reuse. **+10.4% increment over #2** (cumulative with #2 = **+17.66%**).

**Combined (all three):** **+29.93% geomean**, correctness PASS, memory-neutral (`max_mem_ratio 1.00`),
no CUDA errors, on a frozen paired verification run.

## Mechanism theme

Every win **eliminates a kernel launch and/or an HBM round-trip** in the `chunk_kda` forward pipeline
(fusion / launch-count reduction). Autotune-config search and memory-neutral micro-transforms stayed
within measurement noise, and the dominant backward kernel resisted fusion — so the gains came
consistently from forward producer→consumer fusion. Speedups compound multiplicatively when stacked.

## Upstream status

The performance stack was submitted as
[fla-org/flash-linear-attention#1054](https://github.com/fla-org/flash-linear-attention/pull/1054)
on 2026-07-22. Maintainer `zhiyuan1i` called the fusion strategy sound but requested
D128/H32/H64 and Hopper evidence because D64 has limited practical KDA use. The concern
matched the mechanism: every proposed win removed a fixed launch or HBM round-trip, and
those fixed costs should matter less when D128 performs substantially more arithmetic.

The requested follow-up confirmed that concern:

- on the available H200 runner, two independent runs across four D128 shapes measured
  only **1.055–1.061x forward geomean** and **1.001–1.002x forward+backward geomean**;
- `B4_T4096_H64_D128` measured **0.987–0.990x forward** and **0.998–1.000x
  forward+backward**; and
- isolated B200 D128 checks measured paired q/k L2 norm at 1.015x forward / 1.001x
  forward+backward and cumsum producer fusion at 0.999x / 1.000x.

H200 is Hopper-family hardware, but these are not direct H100 measurements. More
importantly, the practical training path was essentially unchanged. The 432-line
performance stack was therefore not justified against current FLA, and #1054 was closed
without merge on 2026-08-07. The result here remains a narrow historical D64 case study,
not general KDA acceleration.

The follow-up also isolated a separate correctness issue: B200/SM100 backward autotuning
could explore `BK == 32` with unsafe 4/8-warp configurations and trigger an illegal
memory access. Focused PR
[fla-org/flash-linear-attention#1109](https://github.com/fla-org/flash-linear-attention/pull/1109)
filters only those SM100 configurations while leaving Hopper and SM120 unchanged. The
full B200 KDA test file passed (**76 passed, 7 skipped**), and `zhiyuan1i` approved the PR
on 2026-08-07. It was open and awaiting merge at the time of this update.

This is the intended evidence-driven outcome: preserve the reproducible D64 numbers,
retire the performance route that failed to generalise, and upstream the small
independently reproducible correctness fix.

## Files

- `flash_linear_attention_kda_fusions.patch` — the combined diff vs `ccb0ff94` (5 files, +432/-32);
  it does **not** modify the evaluator, baseline, or any external repository state.
- `certified_results.json` — per-optimization and combined certified numbers.

## Caveats

1. **The headline number is the least certified one.** The **+29.93% combined** figure is a
   single frozen paired verification run (fwd + fwd+bwd). The three component optimizations
   are each **N>=10** certified; a full N>=10 certification of the combined stack would
   tighten it (expected ~+25–30%). The strongest number that clears the stated certification
   bar is the **+17.66%** cumulative of optimizations #2 and #3.
2. **Generalisation was tested and the practical performance claim failed.** See
   *Upstream status*: representative D128 forward+backward was effectively unchanged,
   so the original fusion stack was retired rather than rebased.
