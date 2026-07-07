# KnotQuite Puzzle Design & Generation

This document describes KnotQuite's puzzle quality standards and the generation pipeline.

## Overview

Puzzles are generated via an automated pipeline that ensures high semantic quality and eliminates common bad patterns:
- **Bad pattern 1**: Obscure proper nouns (people's names) as category members
- **Bad pattern 2**: Wikipedia-list-style categories ("People from X", "Deaths in Y")
- **Bad pattern 3**: Color-shade names grouped together

The pipeline consists of:
1. **Authoring** — LM-assisted generation with the rules below
2. **Validation** — Mechanical checks (structure + obscurity + colors + corpus hygiene)
3. **Curation** — Manual spot-check before shipping

## Puzzle Repository

Puzzles live in:
```
src/data/puzzles.json       # Bundled into app, served to players
src/data/dailyOrder.json    # Deterministic daily rotation (generated)
```

Daily puzzles are selected via epoch-based indexing: consistent across all installs, UTC-based day boundary, stable under pool growth.

## Schema

Each puzzle is a JSON object with this exact structure:

```json
{
  "id": 21,
  "theme": "Overarching theme that ties all 4 groups together",
  "groups": [
    {
      "name": "Category Name",
      "words": ["WORD1", "WORD2", "WORD3", "WORD4"],
      "difficulty": 1,
      "color": "yellow"
    },
    {
      "name": "Category Name",
      "words": ["WORD5", "WORD6", "WORD7", "WORD8"],
      "difficulty": 2,
      "color": "green"
    },
    {
      "name": "Category Name",
      "words": ["WORD9", "WORD10", "WORD11", "WORD12"],
      "difficulty": 3,
      "color": "blue"
    },
    {
      "name": "Category Name",
      "words": ["WORD13", "WORD14", "WORD15", "WORD16"],
      "difficulty": 4,
      "color": "purple"
    }
  ],
  "redHerring": {
    "falseCategoryName": "What the 3 decoy words seem to have in common",
    "words": ["WORD2", "WORD7", "WORD14"]
  }
}
```

## Field Reference

| Field | Type | Description |
|---|---|---|
| `id` | integer | Unique ID. Use the next sequential number after the last puzzle in the file. |
| `theme` | string | The overarching theme connecting all 4 groups (e.g., "Things in a Kitchen"). |
| `groups` | array of 4 | Exactly 4 group objects, one per difficulty level. |
| `groups[].name` | string | The category name shown when solved (e.g., "Cooking Verbs"). |
| `groups[].words` | array of 4 strings | Exactly 4 words. **Must be ALL UPPERCASE.** |
| `groups[].difficulty` | 1, 2, 3, or 4 | 1 = easiest (yellow), 4 = hardest (purple). Each puzzle must have one of each. |
| `groups[].color` | string | Must match difficulty: 1→`"yellow"`, 2→`"green"`, 3→`"blue"`, 4→`"purple"`. |
| `redHerring.falseCategoryName` | string | The fake category the 3 decoy words suggest. |
| `redHerring.words` | array of 3 strings | Exactly 3 words that exist in the puzzle's groups but span **different** groups. |

## Rules for Good Puzzles

### Required
1. **16 unique words total** — no duplicates across groups
2. **All words UPPERCASE** — the UI displays them uppercase
3. **Exactly 4 groups of 4 words** — no more, no less
4. **One difficulty per group** — difficulties 1, 2, 3, 4 must each appear exactly once
5. **Color matches difficulty** — yellow=1, green=2, blue=3, purple=4
6. **Red herring uses words from the puzzle** — the 3 words must exist in the groups
7. **Red herring words span different groups** — at least 2 different groups, ideally 3

### Design Guidelines
8. **Overarching theme** — all 4 groups should connect to a broader topic (e.g., theme "Music" with groups: Guitar Parts, Genres, Musical Directions, Famous Bands)
9. **Difficulty progression** — yellow should be the most obvious grouping, purple the trickiest (words that could belong to multiple categories)
10. **Red herring should be tempting** — the 3 decoy words should strongly suggest a fake 5th category. Players should be tempted to group them together
11. **Avoid obscure words** — stick to commonly known English words
12. **Keep words short** — single words work best. Two-word phrases are okay but rare (the grid tiles are small)
13. **Cross-group ambiguity is good** — the best puzzles have words that *could* fit in multiple groups but only belong to one

## Example Puzzle

```json
{
  "id": 7,
  "theme": "Space Exploration",
  "groups": [
    { "name": "Planets", "words": ["MERCURY", "JUPITER", "NEPTUNE", "EARTH"], "difficulty": 1, "color": "yellow" },
    { "name": "NASA Missions", "words": ["APOLLO", "GEMINI", "VOYAGER", "PIONEER"], "difficulty": 2, "color": "green" },
    { "name": "Space Objects", "words": ["COMET", "NEBULA", "PULSAR", "QUASAR"], "difficulty": 3, "color": "blue" },
    { "name": "Astronaut Terms", "words": ["ORBIT", "LAUNCH", "DOCK", "GRAVITY"], "difficulty": 4, "color": "purple" }
  ],
  "redHerring": { "falseCategoryName": "Greek/Roman Gods", "words": ["MERCURY", "APOLLO", "GEMINI"] }
}
```

Why this works:
- **Theme:** "Space Exploration" ties Planets, NASA Missions, Space Objects, and Astronaut Terms together
- **Red herring:** MERCURY (planet), APOLLO (mission), and GEMINI (mission) are all also Greek/Roman gods — a tempting false grouping that pulls from 2 different real groups
- **Difficulty:** Planets are easy to spot, NASA missions are moderate, space objects need some knowledge, and astronaut terms are tricky because words like DOCK and LAUNCH have common non-space meanings

## Validation Checklist

Before adding a puzzle, verify:

- [ ] `id` is unique (not already used in the file)
- [ ] Exactly 4 groups with exactly 4 words each (16 words total)
- [ ] All 16 words are unique
- [ ] All words are UPPERCASE
- [ ] Difficulties are 1, 2, 3, 4 (one each)
- [ ] Colors match: yellow/green/blue/purple for 1/2/3/4
- [ ] Red herring has exactly 3 words
- [ ] All 3 red herring words exist in the groups
- [ ] Red herring words come from at least 2 different groups
- [ ] The `falseCategoryName` is a plausible category for the 3 red herring words
- [ ] The JSON is valid (no trailing commas, proper quoting)

## Batch Adding

To add multiple puzzles at once, append them to the array in `src/data/puzzles.json`. The file is a flat JSON array:

```json
[
  { "id": 1, ... },
  { "id": 2, ... },
  { "id": 21, "theme": "Your New Puzzle", ... },
  { "id": 22, "theme": "Another New Puzzle", ... }
]
```

No code changes, imports, or config updates are needed. The app reads the full array at runtime and selects puzzles by random or date-seeded index.

## Current Puzzle Count

The file currently contains **20 puzzles** (IDs 1–20). New puzzles should start at ID **21**.
