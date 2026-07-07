#!/usr/bin/env node
/**
 * Validate puzzle JSON against the GAMESPROMPT.md quality checklist.
 * Runs structural, semantic, and corpus-hygiene checks.
 *
 * Usage:  node scripts/validate_puzzles.js <path-to-puzzles-json>
 *         Outputs validation report and counts pass/fail.
 */

const fs = require('fs/promises');
const path = require('path');

// Load reference data
async function loadReferenceData() {
  const commonWordsPath = path.resolve(__dirname, 'lib', 'common-words.json');
  const colorNamesPath = path.resolve(__dirname, 'lib', 'color-names.json');
  const allowlistPath = path.resolve(__dirname, 'lib', 'proper-noun-allowlist.json');

  const [commonWordsJson, colorNamesJson, allowlistJson] = await Promise.all([
    fs.readFile(commonWordsPath, 'utf8').then(t => JSON.parse(t)),
    fs.readFile(colorNamesPath, 'utf8').then(t => JSON.parse(t)),
    fs.readFile(allowlistPath, 'utf8').then(t => JSON.parse(t)),
  ]);

  return {
    commonWords: new Set(commonWordsJson.words.map(w => w.toLowerCase())),
    colorNames: new Set(colorNamesJson.colors.map(c => c.toUpperCase())),
    allowlist: new Set([
      ...allowlistJson.names,
      ...allowlistJson.brands,
      ...allowlistJson.places,
      ...allowlistJson.planets_celestial,
    ].map(n => n.toUpperCase())),
  };
}

// Rejection reason tracking
class ValidationReport {
  constructor(puzzleId) {
    this.puzzleId = puzzleId;
    this.reasons = [];
    this.isValid = true;
  }

  reject(reason) {
    this.reasons.push(reason);
    this.isValid = false;
  }
}

// 1. STRUCTURAL CHECKS
function checkStructural(puzzle, report) {
  const { id, theme, groups, redHerring } = puzzle;

  // Unique ID
  if (typeof id !== 'number') {
    report.reject('Invalid id type');
    return;
  }

  // Theme exists
  if (!theme || typeof theme !== 'string') {
    report.reject('Missing or invalid theme');
  }

  // Exactly 4 groups
  if (!Array.isArray(groups) || groups.length !== 4) {
    report.reject(`Expected 4 groups, got ${groups?.length || 0}`);
    return;
  }

  // Each group: 4 words, valid difficulty/color
  const allWords = [];
  const seenDifficulties = new Set();

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    if (!group.name || typeof group.name !== 'string') {
      report.reject(`Group ${i}: missing or invalid name`);
    }

    // 4 words per group
    if (!Array.isArray(group.words) || group.words.length !== 4) {
      report.reject(`Group ${i} "${group.name}": expected 4 words, got ${group.words?.length || 0}`);
      continue;
    }

    // All uppercase
    for (const word of group.words) {
      if (typeof word !== 'string') {
        report.reject(`Group ${i} "${group.name}": non-string word`);
        continue;
      }
      if (word !== word.toUpperCase()) {
        report.reject(`Group ${i} "${group.name}": word not uppercase: "${word}"`);
      }
      allWords.push(word);
    }

    // Difficulty is 1-4
    if (![1, 2, 3, 4].includes(group.difficulty)) {
      report.reject(`Group ${i} "${group.name}": invalid difficulty ${group.difficulty}`);
    } else {
      seenDifficulties.add(group.difficulty);
    }

    // Color matches difficulty
    const colorMap = { 1: 'yellow', 2: 'green', 3: 'blue', 4: 'purple' };
    if (group.color !== colorMap[group.difficulty]) {
      report.reject(`Group ${i} "${group.name}": color ${group.color} doesn't match difficulty ${group.difficulty}`);
    }
  }

  // Check 16 unique words total
  const uniqueWords = new Set(allWords);
  if (allWords.length !== 16 || uniqueWords.size !== 16) {
    report.reject(`Expected 16 unique words across groups, got ${allWords.length} total, ${uniqueWords.size} unique`);
  }

  // Difficulties must be 1, 2, 3, 4 (one each)
  if (seenDifficulties.size !== 4) {
    report.reject(`Not all difficulties 1-4 represented: ${Array.from(seenDifficulties).sort().join(',')}`);
  }

  // Red herring checks
  if (!redHerring || typeof redHerring !== 'object') {
    report.reject('Missing or invalid redHerring');
    return;
  }

  if (!Array.isArray(redHerring.words) || redHerring.words.length !== 3) {
    report.reject(`Red herring: expected 3 words, got ${redHerring.words?.length || 0}`);
  } else {
    // Each red herring word must exist in exactly one group
    let validRH = true;
    const rhGroupIndices = new Set();
    for (const rhWord of redHerring.words) {
      const groupsWithWord = groups.reduce((acc, g, idx) => {
        if (g.words.includes(rhWord)) acc.push(idx);
        return acc;
      }, []);

      if (groupsWithWord.length !== 1) {
        report.reject(`Red herring word "${rhWord}" appears in ${groupsWithWord.length} groups (expected 1)`);
        validRH = false;
      } else {
        rhGroupIndices.add(groupsWithWord[0]);
      }
    }

    // Red herring words must span at least 2 different groups (ideally 3)
    if (validRH && rhGroupIndices.size < 2) {
      report.reject(`Red herring words span only ${rhGroupIndices.size} group(s), need ≥2`);
    }
  }
}

// 2. OBSCURITY SCREEN
function checkObscurity(puzzle, report, refs) {
  const { groups } = puzzle;
  const properNounPattern = /^[A-Z][A-Z'.-]*\s+[A-Z][A-Z'.-]*(\s+[A-Z][A-Z'.-]*)?$/;
  const wikipediaListPattern = /^(people|players|alumni|deaths?|births?|actors?|actresses|politicians|footballers|writers?|expatriates?|natives?|residents?|graduates|mayors?|justices?)\s+(from|of|in|by)\b/i;
  const countryVoivodeshipPattern = /from\s+.+(county|voivodeship|province|township|district|prefecture|state|region|oblast|raion|arrondissement)\b/i;

  // Check category names
  for (let i = 0; i < groups.length; i++) {
    const name = groups[i].name;
    if (wikipediaListPattern.test(name)) {
      report.reject(`Group ${i}: category name looks like Wikipedia list: "${name}"`);
    }
    if (countryVoivodeshipPattern.test(name)) {
      report.reject(`Group ${i}: category name looks like Wikipedia geo-list: "${name}"`);
    }
  }

  // Check words for majority-proper-noun pattern
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const words = group.words;

    let properNounCount = 0;
    for (const word of words) {
      // Check if it matches proper-noun shape AND is not in allowlist AND not in common words
      if (
        properNounPattern.test(word) &&
        !refs.allowlist.has(word) &&
        !refs.commonWords.has(word.toLowerCase())
      ) {
        properNounCount++;
      }
    }

    // Majority (≥3 out of 4) of words are obscure proper nouns
    if (properNounCount >= 3) {
      report.reject(`Group ${i} "${group.name}": ${properNounCount}/4 words are obscure proper nouns: ${words.join(', ')}`);
    }
  }
}

// 3. COLOR-NAME SCREEN
function checkColors(puzzle, report, refs) {
  const { groups } = puzzle;
  const colorNamePattern = /colou?r|shade|hue|paint/i;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];

    // Check category name
    if (colorNamePattern.test(group.name)) {
      report.reject(`Group ${i}: category name contains color term: "${group.name}"`);
    }

    // Check words: ≥2 words on color list
    let colorCount = 0;
    for (const word of group.words) {
      if (refs.colorNames.has(word)) {
        colorCount++;
      }
    }
    if (colorCount >= 2) {
      report.reject(`Group ${i} "${group.name}": ${colorCount}/4 words are color-shade names`);
    }
  }
}

// 4. CORPUS HYGIENE (basic checks)
function checkCorpusHygiene(puzzle, report, seenWords, seenCategories) {
  const { id, groups } = puzzle;

  // Check word recurrence across all puzzles (cap at ~5)
  for (const group of groups) {
    for (const word of group.words) {
      if (seenWords.has(word)) {
        seenWords.get(word).count++;
        seenWords.get(word).puzzles.push(id);
      } else {
        seenWords.set(word, { count: 1, puzzles: [id] });
      }
    }
  }

  // Check category name uniqueness
  for (const group of groups) {
    const normName = group.name.toLowerCase().trim();
    if (seenCategories.has(normName)) {
      report.reject(`Duplicate category name (normalized): "${group.name}" (also in puzzle ${seenCategories.get(normName)})`);
    } else {
      seenCategories.set(normName, id);
    }
  }
}

// Main validation loop
(async () => {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node validate_puzzles.js <path-to-puzzles.json>');
    process.exit(1);
  }

  let puzzles;
  try {
    const content = await fs.readFile(filePath, 'utf8');
    puzzles = JSON.parse(content);
  } catch (e) {
    console.error(`Failed to read/parse ${filePath}:`, e.message);
    process.exit(1);
  }

  if (!Array.isArray(puzzles)) {
    console.error('Expected JSON array of puzzles');
    process.exit(1);
  }

  const refs = await loadReferenceData();
  const reports = [];
  const seenWords = new Map();
  const seenCategories = new Map();

  console.log(`Validating ${puzzles.length} puzzles...\n`);

  for (const puzzle of puzzles) {
    const report = new ValidationReport(puzzle.id);

    checkStructural(puzzle, report);
    if (!report.isValid) {
      reports.push(report);
      continue; // skip semantic checks if structural checks fail
    }

    checkObscurity(puzzle, report, refs);
    checkColors(puzzle, report, refs);
    checkCorpusHygiene(puzzle, report, seenWords, seenCategories);

    reports.push(report);
  }

  // Summary
  const validCount = reports.filter(r => r.isValid).length;
  const invalidCount = reports.filter(r => !r.isValid).length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULTS: ${validCount} valid, ${invalidCount} invalid`);
  console.log(`${'='.repeat(60)}\n`);

  // Report failures
  if (invalidCount > 0) {
    console.log(`FAILURES (first 50):\n`);
    const failures = reports.filter(r => !r.isValid).slice(0, 50);
    for (const report of failures) {
      console.log(`[${report.puzzleId}]`);
      for (const reason of report.reasons) {
        console.log(`  - ${reason}`);
      }
    }

    if (invalidCount > 50) {
      console.log(`\n... and ${invalidCount - 50} more failures.\n`);
    }
  }

  // Warn about high-recurrence words
  console.log(`\nHIGH-RECURRENCE WORDS (>5 times):\n`);
  const highRecurrence = Array.from(seenWords.entries())
    .filter(([, data]) => data.count > 5)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20);

  if (highRecurrence.length > 0) {
    for (const [word, data] of highRecurrence) {
      console.log(`  "${word}": ${data.count} times in puzzles ${data.puzzles.join(', ')}`);
    }
  } else {
    console.log('  (none found)');
  }

  process.exit(invalidCount > 0 ? 1 : 0);
})();
