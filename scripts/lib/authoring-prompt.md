# KnotQuite Puzzle Authoring Prompt

You are generating high-quality word-group puzzles in the style of the New York Times Connections game. Each puzzle must be playable, coherent, and have a clear unifying theme.

## Rules (from GAMESPROMPT.md — follow exactly)

### Structural Requirements
- **16 unique words total**: Exactly 4 groups × 4 words each
- **All words UPPERCASE**: The UI displays them uppercase
- **Exactly 4 groups of 4 words**: No more, no less
- **One difficulty per group**: Difficulties 1, 2, 3, 4 must each appear exactly once
- **Color matches difficulty**: yellow=1, green=2, blue=3, purple=4
- **Red herring uses words from the puzzle**: The 3 decoy words must exist in the groups
- **Red herring words span different groups**: At least 2 different groups, ideally 3

### Design Guidelines
- **Overarching theme**: All 4 groups should connect to a broader topic (e.g., theme "Music" with groups: Guitar Parts, Genres, Musical Directions, Famous Bands)
- **Difficulty progression**: Yellow should be the most obvious grouping, purple the trickiest (words that could belong to multiple categories)
- **Red herring should be tempting**: The 3 decoy words should strongly suggest a fake 5th category. Players should be tempted to group them together
- **Avoid obscure words**: Stick to commonly known English words that a typical adult would know
- **Keep words short**: Single words work best. Two-word phrases are rare and only for well-known terms (e.g. "BLUE MOON", "COFFEE TABLE")
- **Cross-group ambiguity is good**: The best puzzles have words that *could* fit in multiple groups but only belong to one

### What to AVOID
- **Never use obscure proper nouns**: Names like "WAME LEWARAVU" or "CALVIN LEAVY" are unsolvable. Only use globally-famous names (EINSTEIN, SHAKESPEARE, PARIS, TOKYO). When in doubt, omit the proper noun entirely.
- **Never build a category from color-shade names**: Don't create a group like "CRIMSON, MAROON, SCARLET, VERMILION". Color words are bad categories.
- **Never use Wikipedia list titles as category names**: Avoid "People from X", "Deaths in Y", "Players from Z", "Writers from W". These are not playable — they require lookups. Use semantic categories instead: "Cooking Verbs", "Types of Pasta", "Things in a Kitchen", "Words that can follow CAR".
- **Never duplicate words across groups**: All 16 words must be unique.
- **Never have more than 2 words in a group be proper nouns**: Stick to common nouns, verbs, adjectives. Proper nouns in isolation (a famous single name) can work for difficulty 3-4, but not wholesale.

## Example Puzzle (from GAMESPROMPT.md)

```json
{
  "id": 7,
  "theme": "Space Exploration",
  "groups": [
    {
      "name": "Planets",
      "words": ["MERCURY", "JUPITER", "NEPTUNE", "EARTH"],
      "difficulty": 1,
      "color": "yellow"
    },
    {
      "name": "NASA Missions",
      "words": ["APOLLO", "GEMINI", "VOYAGER", "PIONEER"],
      "difficulty": 2,
      "color": "green"
    },
    {
      "name": "Space Objects",
      "words": ["COMET", "NEBULA", "PULSAR", "QUASAR"],
      "difficulty": 3,
      "color": "blue"
    },
    {
      "name": "Astronaut Terms",
      "words": ["ORBIT", "LAUNCH", "DOCK", "GRAVITY"],
      "difficulty": 4,
      "color": "purple"
    }
  ],
  "redHerring": {
    "falseCategoryName": "Greek/Roman Gods",
    "words": ["MERCURY", "APOLLO", "GEMINI"]
  }
}
```

Why this works:
- **Theme**: "Space Exploration" ties Planets, NASA Missions, Space Objects, and Astronaut Terms together
- **Red herring**: MERCURY (planet), APOLLO (mission), and GEMINI (mission) are all also Greek/Roman gods — a tempting false grouping that pulls from 2 different real groups
- **Difficulty**: Planets are easy to spot, NASA missions are moderate, space objects need some knowledge, and astronaut terms are tricky because words like DOCK and LAUNCH have common non-space meanings
- **Word quality**: All words are common English words anyone would know

## Output Format

Generate puzzle(s) as a JSON array. If generating multiple, enclose in:
```json
[
  { puzzle 1 },
  { puzzle 2 },
  ...
]
```

**Every puzzle must follow the schema exactly**, with all required fields and valid values.

---

Now generate puzzles following these rules. Be creative but rigorous about avoiding proper nouns, color-shade categories, and Wikipedia list-style names.
