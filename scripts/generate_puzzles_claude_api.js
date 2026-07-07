#!/usr/bin/env node
/**
 * Generate KnotQuite puzzles via Claude API (Anthropic).
 * Batches puzzles per call for efficiency.
 *
 * Usage:  ANTHROPIC_API_KEY=sk-... node scripts/generate_puzzles_claude_api.js [count]
 *         Default count = 150
 */

const fs = require('fs/promises');
const path = require('path');
const { execSync } = require('child_process');

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY environment variable not set');
  process.exit(1);
}

const WANTED = parseInt(process.argv[2] || '150', 10);
const PUZZLES_PER_BATCH = 5; // Generate 5 at a time for efficiency
const MAX_BATCH_RETRIES = 3;
const PUZZLES_FILE = path.resolve(__dirname, '..', 'src', 'data', 'puzzles.json');

async function loadPrompt() {
  try {
    return await fs.readFile(path.resolve(__dirname, 'lib', 'authoring-prompt.md'), 'utf8');
  } catch (e) {
    throw new Error(`Could not load authoring prompt: ${e.message}`);
  }
}

function getNextId() {
  let maxId = 0;
  try {
    const existing = JSON.parse(fs.readFileSync(PUZZLES_FILE, 'utf8'));
    if (Array.isArray(existing) && existing.length > 0) {
      maxId = Math.max(...existing.map(p => p.id || 0));
    }
  } catch (e) {
    // File doesn't exist yet
  }
  return maxId + 1;
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

(async () => {
  console.log(`Generating ${WANTED} puzzles via Claude API`);
  console.log(`Batch size: ${PUZZLES_PER_BATCH} puzzles per API call\n`);

  const basePrompt = await loadPrompt();
  let nextId = getNextId();
  let puzzles = [];

  // Load existing puzzles if any
  try {
    const existing = await fs.readFile(PUZZLES_FILE, 'utf8');
    puzzles = JSON.parse(existing);
  } catch (e) {
    puzzles = [];
  }

  const startingCount = puzzles.length;
  console.log(`Starting with ${startingCount} existing puzzles\n`);

  let created = 0;
  let batchNum = 0;

  while (created < WANTED) {
    batchNum++;
    let batchSuccess = false;

    for (let retry = 0; retry < MAX_BATCH_RETRIES && !batchSuccess; retry++) {
      try {
        const idsNeeded = Math.min(PUZZLES_PER_BATCH, WANTED - created);
        const idRange = `${nextId} through ${nextId + idsNeeded - 1}`;

        console.log(`[Batch ${batchNum}] Generating ${idsNeeded} puzzles (IDs ${idRange})...`);

        const batchPrompt = `${basePrompt}\n\nGenerate exactly ${idsNeeded} high-quality puzzles with IDs ${idRange}. Output ONLY a JSON array.`;

        const response = await callClaudeAPI(batchPrompt);
        const candidates = extractJSON(response);

        if (candidates.length === 0) {
          console.log('  ✗ No valid JSON in response, retrying...\n');
          continue;
        }

        let validCount = 0;
        for (const puzzle of candidates) {
          if (!puzzle.id) {
            puzzle.id = nextId++;
          } else {
            nextId = Math.max(nextId, puzzle.id + 1);
          }

          const validation = await validateCandidate(puzzle);
          if (validation.valid) {
            puzzles.push(puzzle);
            console.log(`  ✓ Valid: puzzle ${puzzle.id}`);
            validCount++;
            created++;
            if (created >= WANTED) break;
          } else {
            console.log(`  ✗ Invalid: puzzle ${puzzle.id}`);
          }
        }

        console.log(`  Batch result: ${validCount}/${candidates.length} valid\n`);
        batchSuccess = validCount > 0;
      } catch (e) {
        console.error(`  ✗ API error: ${e.message}\n`);
      }
    }

    if (!batchSuccess) {
      console.warn(`⚠ Batch ${batchNum} failed after ${MAX_BATCH_RETRIES} retries, skipping\n`);
    }
  }

  // Save puzzles
  try {
    await fs.writeFile(PUZZLES_FILE, JSON.stringify(puzzles, null, 2), 'utf8');
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Created ${created} new puzzles`);
    console.log(`Total in puzzles.json: ${puzzles.length}`);
    console.log(`Wrote to ${PUZZLES_FILE}`);
    console.log(`${'='.repeat(60)}`);
  } catch (e) {
    console.error('Failed to write puzzles.json:', e.message);
    process.exit(1);
  }
})();
