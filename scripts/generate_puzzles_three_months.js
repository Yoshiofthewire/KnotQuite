#!/usr/bin/env node
/**
 * Generate 3 months of KnotQuite puzzles via Claude API.
 * Produces 450 puzzles: 90 daily (IDs 1-90) + 360 random (IDs 91-450)
 *
 * Daily and random puzzles are completely separate pools:
 * - Daily puzzles can ONLY appear in daily rotation
 * - Random puzzles can ONLY appear in random selection
 * - No puzzle appears in both
 *
 * Usage:  ANTHROPIC_API_KEY=sk-... node scripts/generate_puzzles_three_months.js
 *
 * The script:
 * 1. Generates 450 puzzles via Claude API (in batches of 5)
 * 2. Marks IDs 1-90 as type 'daily'
 * 3. Marks IDs 91-450 as type 'random'
 * 4. Saves to src/data/puzzles.json
 * 5. Generates a daily order for the 90 daily puzzles
 */

const fs = require('fs/promises');
const path = require('path');
const { execSync } = require('child_process');

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY environment variable not set');
  process.exit(1);
}

const TOTAL_PUZZLES = 450;
const DAILY_PUZZLES = 90; // 1 per day × 90 days (3 months)
const PUZZLES_PER_BATCH = 5;
const MAX_BATCH_RETRIES = 3;
const PUZZLES_FILE = path.resolve(__dirname, '..', 'src', 'data', 'puzzles.json');
const DAILY_ORDER_FILE = path.resolve(__dirname, '..', 'src', 'data', 'dailyOrder.json');

async function loadPrompt() {
  try {
    return await fs.readFile(path.resolve(__dirname, 'lib', 'authoring-prompt.md'), 'utf8');
  } catch (e) {
    throw new Error(`Could not load authoring prompt: ${e.message}`);
  }
}

async function validateCandidate(puzzle) {
  try {
    const tempFile = path.resolve(__dirname, '..', '.tmp-validate.json');
    await fs.writeFile(tempFile, JSON.stringify([puzzle]), 'utf8');
    execSync(`node ${path.resolve(__dirname, 'validate_puzzles.js')} ${tempFile}`, {
      stdio: 'pipe',
    });
    await fs.unlink(tempFile).catch(() => {});
    return { valid: true };
  } catch (e) {
    return { valid: false };
  }
}

async function callClaudeAPI(prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-1',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error ${response.status}: ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

function extractJSON(text) {
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/) || null;
  const jsonText = jsonMatch ? jsonMatch[1] : text;

  try {
    const parsed = JSON.parse(jsonText);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    return [];
  }
}

// Seeded random number generator for deterministic daily order
class SeededRandom {
  constructor(seed) {
    this.state = 0;
    for (let i = 0; i < seed.length; i++) {
      this.state = ((this.state << 5) - this.state) + seed.charCodeAt(i);
      this.state = this.state & this.state;
    }
  }

  next() {
    this.state = (this.state * 1103515245 + 12345) & 0x7fffffff;
    return this.state / 0x7fffffff;
  }
}

function shuffleWithSeed(arr, seed) {
  const result = [...arr];
  const rng = new SeededRandom(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

async function generateDailyOrder(dailyPuzzleIds) {
  const shuffled = shuffleWithSeed(dailyPuzzleIds, 'knotquite-daily-v1');
  await fs.writeFile(DAILY_ORDER_FILE, JSON.stringify(shuffled, null, 2), 'utf8');
  console.log(`\n📅 Created daily order for ${shuffled.length} daily puzzles`);
  return shuffled;
}

(async () => {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🎮 KnotQuite Puzzle Generation: 3 Months (450 puzzles)`);
  console.log(`${'='.repeat(70)}`);
  console.log(`\n📊 Plan:`);
  console.log(`   • ${DAILY_PUZZLES} daily puzzles (IDs 1-${DAILY_PUZZLES}) - 1 per day, 3 months`);
  console.log(`   • ${TOTAL_PUZZLES - DAILY_PUZZLES} random puzzles (IDs ${DAILY_PUZZLES + 1}-${TOTAL_PUZZLES}) - 4 per day`);
  console.log(`   • Batch size: ${PUZZLES_PER_BATCH} puzzles per API call`);
  console.log(`   • Validation: Each puzzle checked before acceptance\n`);

  const basePrompt = await loadPrompt();
  let puzzles = [];
  let nextId = 1;
  let created = 0;
  let batchNum = 0;

  console.log(`🚀 Starting puzzle generation...\n`);

  while (created < TOTAL_PUZZLES) {
    batchNum++;
    let batchSuccess = false;

    for (let retry = 0; retry < MAX_BATCH_RETRIES && !batchSuccess; retry++) {
      try {
        const idsNeeded = Math.min(PUZZLES_PER_BATCH, TOTAL_PUZZLES - created);
        const idRange = `${nextId} through ${nextId + idsNeeded - 1}`;
        const puzzleType = nextId <= DAILY_PUZZLES ? 'daily' : 'random';

        console.log(`[Batch ${String(batchNum).padStart(3)}] Generating ${idsNeeded} ${puzzleType} puzzles (IDs ${idRange})...`);

        const batchPrompt = `${basePrompt}\n\nGenerate exactly ${idsNeeded} high-quality puzzles with IDs ${idRange}. Output ONLY a JSON array.`;

        const response = await callClaudeAPI(batchPrompt);
        const candidates = extractJSON(response);

        if (candidates.length === 0) {
          console.log(`          ✗ No valid JSON in response, retrying...\n`);
          continue;
        }

        let validCount = 0;
        for (const puzzle of candidates) {
          if (!puzzle.id) {
            puzzle.id = nextId;
          } else {
            nextId = Math.max(nextId, puzzle.id);
          }

          // Mark puzzle type based on ID
          puzzle.type = puzzle.id <= DAILY_PUZZLES ? 'daily' : 'random';

          const validation = await validateCandidate(puzzle);
          if (validation.valid) {
            puzzles.push(puzzle);
            console.log(`          ✓ Valid: puzzle ${puzzle.id} (${puzzle.type})`);
            validCount++;
            created++;
            nextId++;
            if (created >= TOTAL_PUZZLES) break;
          } else {
            console.log(`          ✗ Invalid: puzzle ${puzzle.id}`);
            nextId++;
          }
        }

        console.log(`          Batch result: ${validCount}/${candidates.length} valid\n`);
        batchSuccess = validCount > 0;
      } catch (e) {
        console.error(`          ✗ API error: ${e.message}\n`);
      }
    }

    if (!batchSuccess) {
      console.warn(`⚠️  Batch ${batchNum} failed after ${MAX_BATCH_RETRIES} retries, skipping\n`);
    }
  }

  // Save puzzles
  try {
    await fs.writeFile(PUZZLES_FILE, JSON.stringify(puzzles, null, 2), 'utf8');
    console.log(`\n${'='.repeat(70)}`);
    console.log(`✅ Puzzle Generation Complete`);
    console.log(`${'='.repeat(70)}`);
    console.log(`\n📈 Summary:`);

    const dailyCount = puzzles.filter(p => p.type === 'daily').length;
    const randomCount = puzzles.filter(p => p.type === 'random').length;

    console.log(`   • Daily puzzles: ${dailyCount}`);
    console.log(`   • Random puzzles: ${randomCount}`);
    console.log(`   • Total: ${puzzles.length}/${TOTAL_PUZZLES}`);

    // Generate daily order
    const dailyPuzzleIds = puzzles
      .filter(p => p.type === 'daily')
      .map(p => p.id)
      .sort((a, b) => a - b);

    if (dailyPuzzleIds.length > 0) {
      await generateDailyOrder(dailyPuzzleIds);
    }

    console.log(`\n📁 Files updated:`);
    console.log(`   • ${PUZZLES_FILE}`);
    console.log(`   • ${DAILY_ORDER_FILE}`);

    console.log(`\n⚠️  Next steps:`);
    console.log(`   1. Run: npm run validate:puzzles`);
    console.log(`   2. Spot-check a sample from puzzles.json`);
    console.log(`   3. Run: npm run build:renderer`);
    console.log(`   4. Test: npm run dev (play both Daily and Random)`);
    console.log(`   5. Commit and push\n`);

  } catch (e) {
    console.error('❌ Failed to write puzzles.json:', e.message);
    process.exit(1);
  }
})();
