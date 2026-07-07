# 🎮 Generate 3-Month Puzzle Supply — Quick Start

## One Command to Generate 450 Puzzles

```bash
export ANTHROPIC_API_KEY=sk-your-key-here
npm run generate:puzzles:3months
```

That's it! The script will:

1. ✅ Generate **450 puzzles total**
   - 90 daily puzzles (IDs 1-90) — one per day for 3 months
   - 360 random puzzles (IDs 91-450) — four per day for random selection

2. ✅ **Separate daily from random**
   - Each puzzle gets a `type: 'daily'` or `type: 'random'` field
   - Daily mode ONLY uses the daily pool
   - Random mode ONLY uses the random pool
   - **No puzzle appears in both**

3. ✅ **Generate daily rotation**
   - Creates `dailyOrder.json` with shuffled daily puzzle IDs
   - Deterministic (same seed = same order)
   - Cycles through all 90 without repeats

4. ✅ **Validate puzzles**
   - Each candidate is validated before acceptance
   - Rejects bad categories, obscure words, structural errors

## After Generation (5-10 minutes per 50 puzzles)

```bash
# 1. Validate the full bank
npm run validate:puzzles

# 2. Spot-check a sample (~30 puzzles) from src/data/puzzles.json
# Look for:
#   - Good theme that unifies all 4 groups
#   - No obscure proper nouns
#   - Plausible red herring
#   - Good difficulty progression

# 3. Build the app and test
npm run build:renderer
npm run dev
# Play at least 1 Daily puzzle and 1 Random puzzle

# 4. Commit
git add .
git commit -m "Generate 3-month puzzle supply (450 puzzles: 90 daily + 360 random)"
git push
```

## Key Features

### ✅ Complete Separation
- Daily puzzles are in a completely separate pool
- Random puzzles are in a completely separate pool
- **Zero overlap** — same puzzle never appears in both

### ✅ Deterministic Daily Order
- Daily order is seeded and deterministic
- Same date = same puzzle across all installs
- No repeats within the 90-day cycle

### ✅ Smart Random Selection
- Random mode skips daily puzzles automatically
- Tracks played puzzles in localStorage
- Cycles through unplayed before repeating

### ✅ Easy to Extend
Later, add more puzzles:
```bash
npm run generate:puzzles 50  # Add 50 more
npm run validate:puzzles
npm run build:daily-order
```

## What Was Changed

### New Files
- `scripts/generate_puzzles_three_months.js` — The generator

### Updated Files
- `package.json` — Added `npm run generate:puzzles:3months`
- `src/renderer/hooks/usePuzzle.ts` — Filters random to `type: 'random'`
- `src/renderer/types/puzzle.ts` — Added optional `type` field
- `PUZZLE_GENERATION.md` — Full documentation

### Generated Files (during generation)
- `src/data/puzzles.json` — All 450 puzzles with type separation
- `src/data/dailyOrder.json` — Daily rotation IDs

## Requirements

- **Node.js** (already have it)
- **ANTHROPIC_API_KEY** environment variable set (Claude API key)
- **Internet connection** (for Claude API calls)

## Troubleshooting

### "ANTHROPIC_API_KEY environment variable not set"
```bash
export ANTHROPIC_API_KEY=sk-your-key-here
npm run generate:puzzles:3months
```

### "API error 401: Unauthorized"
Your API key is invalid or expired. Check Anthropic console for a new key.

### "API error 429: Too Many Requests"
Claude API rate limit hit. Wait a few minutes and retry.

### "No valid JSON found in response"
Rare — the API returned malformed JSON. The script will retry automatically (3 times per batch).

### Generation seems slow
Normal! Generating 450 puzzles via API takes ~1-2 hours depending on API latency and validation. The script shows progress per batch.

## Support

See `PUZZLE_GENERATION.md` for detailed documentation, customization, and advanced workflows.
