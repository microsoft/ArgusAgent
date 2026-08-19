# Affiliation marks

The title page carries two logo rows, one full lockup per author affiliation, in
affiliation-number order. Affiliation 7 (Independent Researcher) has no mark by
definition.

Every mark is the institution's **full lockup** — emblem plus Chinese name plus
English name — rather than the emblem alone, so the row is legible without the
affiliation key.

| # | File | Affiliation | Source |
| --- | --- | --- | --- |
| 1 | `logo-sjtu.png` | Shanghai Jiao Tong University | `vi.sjtu.edu.cn/img/logo-s-w.png` |
| 2 | `logo-microsoft.png` | Microsoft | local logo store |
| 3 | `logo-fudan.png` | Fudan University | `www.fudan.edu.cn` site header |
| 4 | `logo-nju.png` | Nanjing University | `www.nju.edu.cn/images/logo.png` |
| 5 | `logo-thu.png` | Tsinghua University | `www.tsinghua.edu.cn/image/logo180.png` |
| 6 | `logo-hku.png` | The University of Hong Kong | local logo store |
| 8 | `logo-pku.png` | Peking University | `news.pku.edu.cn/images/h-logo1.png` |
| 9 | `logo-cuhk-shenzhen.png` | The Chinese University of Hong Kong, Shenzhen | `File:CUHK(SZ) Logo.png`, zh.wikipedia |
| 10 | `logo-donghua.png` | Donghua University | composed, see below |

Every mark was opened and visually confirmed against the named institution before
use. Affiliation 9 uses the CUHK-Shenzhen lockup (the one carrying "（深圳）/
Shenzhen"), which is a different mark from the CUHK main-campus emblem.

## Colour

The SJTU, Fudan, Nanjing, and Tsinghua site headers publish their lockups as white
artwork for dark backgrounds. Each was recoloured to its own brand ink, sampled as
the dominant opaque pixel of that institution's official colour emblem rather than
chosen by eye:

| Mark | Sampled ink |
| --- | --- |
| Shanghai Jiao Tong University | `#AE1831` |
| Fudan University | `#0E419C` |
| Nanjing University | `#6A005F` |
| Tsinghua University | `#7C2E9A` |

Only the ink changes; the artwork is untouched. Peking University, HKU,
CUHK-Shenzhen, and Microsoft are used in their native colours.

## Composed mark

`logo-donghua.png` is the one assembled mark. Donghua publishes its emblem and its
`东华大学 / DONGHUA UNIVERSITY` wordmark as separate assets and no combined lockup
was found, so the two were set in the same arrangement the other eight marks use
(emblem at full height, wordmark at 62% height, gap at 20% height), with the
wordmark recoloured to the emblem's `#CC0001`. Replace this file if an official
Donghua lockup becomes available.

## Geometry

All files are whitespace- and transparency-trimmed to their content bounding box,
so `height=` in `main.tex` sets the visible height directly. Lockups are set at
0.245 in and the wider wordmark-style marks (Microsoft, HKU, CUHK-Shenzhen) at
0.160--0.185 in so both rows read at one optical weight.

## Retired

- `sjtu-logo.png`, `microsoft-logo.png`: the earlier two-logo title block, kept for
  reference.

The marks are used only to identify the affiliations on the report title page.
