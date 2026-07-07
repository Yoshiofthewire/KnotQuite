#!/usr/bin/env node
/**
 * Generate KnotQuite puzzle candidates via LM Studio.
 *
 * Reads from scripts/lib/authoring-prompt.md, calls LM Studio's local API,
 * validates each candidate, and appends passing candidates to src/data/puzzles.candidates.json.
 *
 * Usage:  node scripts/generate_puzzles_llm.js [count]
 *         Default count = 50 (smaller batches work better with local models).
 */

const fs = require('fs/promises');
const path = require('path');
const { generatePuzzleBatch } = require('./lib/lmstudio-client');
const { execSync } = require('child_process');

const WANTED = parseInt(process.argv[2] || '50', 10);
const MAX_ATTEMPTS_PER_PUZZLE = 5; // local models need more retries
const CANDIDATES_FILE = path.resolve(__dirname, '..', 'src', 'data', 'puzzles.candidates.json');
const PUZZLES_FILE = path.resolve(__dirname, '..', 'src', 'data', 'puzzles.json');
const PROMPT_FILE = path.resolve(__dirname, 'lib', 'authoring-prompt.md');

async function loadPrompt() {
  try {
    return await fs.readFile(PROMPT_FILE, 'utf8');
  } catch (e) {
    throw new Error(
      `Could not load authoring prompt from ${PROMPT_FILE}.\n` +
      `Create scripts/lib/authoring-prompt.md with puzzle generation instructions.`
    );
  }
}

function getNextId() {
  // Get next ID from either puzzles.json or candidates.json, whichever is larger
  let maxId = 0;

  try {
    const existing = JSON.parse(fs.readFileSync(PUZZLES_FILE, 'utf8'));
    if (Array.isArray(existing) && existing.length > 0) {
      maxId = Math.max(...existing.map(p => p.id || 0));
    }
  } catch (e) {
    // puzzles.json might not exist yet
  }

  try {
    const candidates = JSON.parse(fs.readFileSync(CANDIDATES_FILE, 'utf8'));
    if (Array.isArray(candidates) && candidates.length > 0) {
      maxId = Math.max(maxId, ...candidates.map(p => p.id || 0));
    }
  } catch (e) {
    // candidates.json might not exist yet
  }

  return maxId + 1;
}

async function validateCandidate(puzzle) {
  // Run the validator in a subprocess (it exits with code 0 for valid, 1 for invalid)
  try {
    const tempFile = path.resolve(__dirname, '..', '.tmp-validate.json');
    await fs.writeFile(tempFile, JSON.stringify([puzzle]), 'utf8');
    execSync(`node ${path.resolve(__dirname, 'validate_puzzles.js')} ${tempFile}`, {
      stdio: 'pipe',
    });
    await fs.unlink(tempFile);
    return { valid: true, reasons: [] };
  } catch (e) {
    // Validator rejects it
    return {
      valid: false,
      reasons: [e.stdout ? e.stdout.toString() : e.message],
    };
  }
}

function extractJSON(text) {
  // Try to extract JSON array from LLM response
  // Look for ```json ... ``` or just a raw JSON array
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/) || null;
  const jsonText = jsonMatch ? jsonMatch[1] : text;

  try {
    const parsed = JSON.parse(jsonText);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    // Single puzzle object
    if (parsed && typeof parsed === 'object' && parsed.id) {
      return [parsed];
    }
  } catch (e) {
    // JSON parse failed
  }

  return [];
}

(async () => {
  console.log(`Generating up to ${WANTED} puzzle candidates via LM Studio...`);
  console.log(`Max ${MAX_ATTEMPTS_PER_PUZZLE} attempts per puzzle.\n`);

  const basePrompt = await loadPrompt();
  const nextId = getNextId();
  let candidates = [];

  // Try to load existing candidates
  try {
    const existing = await fs.readFile(CANDIDATES_FILE, 'utf8');
    candidates = JSON.parse(existing);
  } catch (e) {
    // File doesn't exist yet
    candidates = [];
  }

  const startingCount = candidates.length;
  console.log(`Starting from ${startingCount} existing candidates, max ID so far: ${nextId - 1}\n`);

  let created = 0;
  let currentId = nextId;

  for (let i = 0; i < WANTED && created < WANTED; i++) {
    let success = false;

    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_PUZZLE && !success; attempt++) {
      try {
        console.log(`Generating batch ${i + 1}/${WANTED} (attempt ${attempt + 1}/${MAX_ATTEMPTS_PER_PUZZLE})...`);

        // Add context about ID range to the prompt
        const contextualPrompt =
          `${basePrompt}\n\nGenerate puzzle(s) with ID(s) starting from ${currentId} and incrementing. Provide 1-3 puzzles per call.`;

        const response = await generatePuzzleBatch(contextualPrompt, 1);
        const puzzles = extractJSON(response);

        if (puzzles.length === 0) {
          console.log('  ✗ No valid JSON found in response, retrying...\n');
          continue;
        }

        // Validate each puzzle
        let validCount = 0;
        for (const puzzle of puzzles) {
          // Ensure ID is set
          if (!puzzle.id) {
            puzzle.id = currentId++;
          } else {
            currentId = Math.max(currentId, puzzle.id + 1);
          }

          const validation = await validateCandidate(puzzle);
          if (validation.valid) {
            candidates.push(puzzle);
            console.log(`  ✓ Valid: puzzle ${puzzle.id}`);
            validCount++;
            created++;
            if (created >= WANTED) break;
          } else {
            console.log(`  ✗ Invalid: puzzle ${puzzle.id}`);
            if (validation.reasons[0]) {
              console.log(`     ${validation.reasons[0].substring(0, 100)}`);
            }
          }
        }

        if (validCount > 0) {
          success = true;
        }
      } catch (e) {
        console.error(`  ✗ Error: ${e.message.substring(0, 100)}\n`);
      }
    }

    if (!success) {
      console.warn(`\n⚠ Failed to create puzzle ${i + 1} after ${MAX_ATTEMPTS_PER_PUZZLE} attempts`);
    }

    console.log();
  }

  // Save candidates
  try {
    await fs.writeFile(CANDIDATES_FILE, JSON.stringify(candidates, null, 2), 'utf8');
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Wrote ${created} new candidates to ${CANDIDATES_FILE}`);
    console.log(`Total candidates: ${candidates.length} (started with ${startingCount})`);
    console.log(`${'='.repeat(60)}`);
  } catch (e) {
    console.error('Failed to write candidates file:', e.message);
    process.exit(1);
  }

  if (created === 0) {
    console.warn('\nWarning: No candidates were created. Check LM Studio connectivity and model loading.');
    process.exit(1);
  }
})();
