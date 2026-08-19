---
name: "Explicit Venue Format Research"
description: "Verify an explicitly selected publication venue and build research/VENUE_PROFILE.json from official deadline and author-kit sources without inferring alternatives."
---

# Venue Selection And Format Research

## When to use

- the named venue is not built in;
- the venue cycle/year/deadline or author kit may be stale;
- no valid `research/VENUE_PROFILE.json` exists.

Do not use this Skill when `target_venue` is absent. An unspecified venue does
not authorize venue discovery or candidate selection. Ask the operator to name
a venue or explicitly request venue discovery.

## Verification policy

Verify only the explicit venue's official CFP/deadline, scope, cycle, author kit,
and exact time zone. Do not search for or select alternatives unless the operator
explicitly requested that separate task. If the venue cannot be verified, write
the blocker and stop venue-dependent drafting rather than inventing a target.

## Required artifacts

### `research/VENUE_SELECTION.md`

Record:

- current UTC timestamp;
- paper domain and contribution shape;
- explicit venue;
- official CFP/deadline URL and time zone;
- open/closed calculation;
- scope fit;
- verification result.

### `research/VENUE_PROFILE.json`

Build a flat `VenueProfile` from the selected venue's official author
instructions/kit, including:

- key/display name and year;
- page or word limits;
- column layout;
- required/end/post-reference sections;
- document class, style package/files, review macro, anonymity;
- bibliography behavior;
- forbidden packages;
- required checklist/pdfinfo/line-number rules;
- reviewer and figure persona.

Use official sources. Record uncertainty rather than guessing.

### `paper/TEMPLATE_SOURCE.md`

Record exact official URLs, extracted values, downloaded style-file provenance,
and any unresolved uncertainty.

### Pipeline state

Update only the descriptive `target_venue` field to the selected profile key.
Do not edit `current_stage` or stage statuses.

## Verification

```bash
python -c "from argus_skill.verticals.research.venue_profiles import resolve_venue_profile as r; p=r('.'); print(p.key, p.display_name, p.page_budget_line())"
```

Fetch the official style files under `paper/` and never modify the venue's
`.sty`/`.cls` to make an invalid paper compile.
