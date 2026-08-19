# RWKV6 Upstream Adoption

This evidence package covers the TileLang RWKV6 contribution cited in the report.
It is distinct from the later `chunk_kda` optimization in
`../fla_kernel_optimization/`.

- Pull request: [fla-org/flash-linear-attention#1045](https://github.com/fla-org/flash-linear-attention/pull/1045)
- Status: merged into `fla-org:main`
- Merge commit: [`c70f11c`](https://github.com/fla-org/flash-linear-attention/commit/c70f11c5530142450525549cc96d13d9f5165f69)
- Operation: opt-in TileLang RWKV6 dense bf16, D=64 forward-intra kernel
- Hardware: NVIDIA H100 NVL
- Reported workload: B=8, T=1024, H=8, D=64
- Reported latency: 0.199 ms to 0.168 ms forward; 0.900 ms to 0.747 ms forward plus backward
- Verification: 13 frozen-gate passes and 14 repository tests

The public pull-request conversation records collaborator inspection of the generated
CUDA, a requested numerical-stability correction, the subsequent fix, passing checks,
and the merge. These links are authoritative for upstream status; the numbers remain
scoped to the reported workload and hardware.