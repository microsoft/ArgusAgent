# MLE-Bench Lite Reviewer-Approved Medal Campaign

This package records the medal outcomes reported in Table~\ref{tab:mle-medals} of
the technical report.

- Benchmark: official MLE-Bench Low split (MLE-Bench Lite)
- Completion gate: `reviewer-approved bronze medal or better`
- Medals to date: 9 (3 gold, 3 silver, 3 bronze) across 11 competitions attempted
- Campaign status: ongoing

## Provenance

Seven of the nine medals are reconciled against the campaign snapshot
`mle-campaign-snapshot-20260729T095000Z` on the GCR Bonete B200 shared PVC
(`pvc-vast-bonete01`), at
`/data/v-boxiuli/argus-mle-lite-runs/mle-campaign-snapshot-20260729T095000Z`.
Within that snapshot:

- `campaign/campaign-state.json` records 7 completed, 10 pending, and 2 running
  competitions, for 19 accessible competitions in total.
- `campaign/grades/<competition>/submissions/*.grade.log` carries the official
  `__MLE_REPORT__` record for every graded submission: score, medal flags, and the
  bronze/silver/gold/median thresholds. 40 graded submissions across 9
  competitions are recorded.
- `campaign/grades/reviewer-approved-state.json` records the last
  Reviewer-approved submission per competition with its content hash.

Two rows carry different provenance and are marked as such in `result.json`:

- `nomad2018-predict-transparent-conductors` is listed as *pending* in the
  2026-07-29 campaign state and closed after the snapshot was taken.
- `detecting-insults-in-social-commentary` was run by the operator outside the
  19-competition accessible set of this campaign, so it has no counterpart in the
  snapshot. Its gold medal was awarded by the external MLE-Bench grader on the same
  basis as the others.

## Margins

Two awards sit close to their band edges, which is why the thresholds are recorded
alongside the scores:

- `denoising-dirty-documents` scored 0.02618 RMSE against a 0.02609 silver
  threshold, missing silver by 0.00009.
- `jigsaw-toxic-comment-classification-challenge` scored 0.98657 AUC against a
  0.98639 bronze threshold, clearing bronze by 0.00018.

Two further competitions were graded without a medal:
`dog-breed-identification` finished above the median after twelve submissions, and
`new-york-city-taxi-fare-prediction` remained below it after four.

Medals are the external grader's award against each competition's official Kaggle
leaderboard, not an internal review verdict.
