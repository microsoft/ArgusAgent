# ACE-2: Runtime-Designed Inference Accelerator

This package records the claims made in Section~\ref{sec:silicon-vertical} of the
technical report. ACE-2 is an inference accelerator for Qwen2.5-0.5B in W4A8 whose
specification, RTL, verification environment, and physical-flow evidence were
produced by the Argus runtime.

- Verdict: `FORMAL_PRODUCT_CERTIFIED`, 2026-08-04
- Issued by a fresh Reviewer that did not perform the work
- Bound to accepted RTL tree `bf12e2c8...ffb4f6`

## Functional closure

Layer 0 matches the reference on all 18 ordered operators exactly. The accepted
24-layer, two-token runtime completes 13,914/13,914 commands over 1,240,410,384
simulator cycles with generated token identifiers `[0, 0]` and no first failure.
The runtime package, command log, and progress journal are each bound by content
hash in the source evidence.

## Physical closure

Canonical SKY130 HD mapped synthesis and OpenSTA at TT 25 C / 1.80 V:

| Metric | Value | Constraint |
| --- | --- | --- |
| Cells | 62,283 | — |
| Non-SRAM area | 0.614082704 mm² | 2.0 mm² cap — PASS |
| Detailed setup slack | +0.6966 ns | — |
| WNS / TNS | 0.00 ns / 0.00 ns | — |
| Clock period | 10.000 ns | 100 MHz floor — PASS |

The passing packet is the sole exactly-once canonical run, not the best of several
attempts.

## What this is not

The certificate enumerates its own exclusions, and they are reproduced verbatim in
`result.json`: no routed timing, no power signoff, no DRC/LVS, no GDS or tapeout,
no silicon validation, no generation beyond two tokens, no external deployment
interfaces, and no FPGA prototype. Any claim beyond the demonstrated scope requires
new operator direction and fresh evidence.

## Source

Project tree `ace-2` on the `argustest` jump host, with the authoritative records at:

- `research/FINAL_PRODUCT_CERTIFICATE.json`
- `.argus/PIPELINE_STATE.json`, `research/PUBLIC_STATUS.json`
- `evidence/canonical_sky130/rtl-final-sumsq-repaired-tree-canonical-sky130-ppa-v1/INDEPENDENT_METRICS.json`
- `evidence/verification/repair-full-qwen-final-lm-head-tile-boundary-v1/runtime_validation.json`
