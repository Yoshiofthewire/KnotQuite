#!/usr/bin/env node
/**
 * Build a deterministic daily puzzle order from the current puzzles.json.
 * Produces src/data/dailyOrder.json: an array of puzzle IDs shuffled via seeded PRNG.
 *
 * This ensures:
 * - No early repeats within a full cycle (every puzzle appears once before any repeat)
 * - Stability across app updates (append new IDs to tail instead of reshuffling)
 * - Pure date-based determinism (same date → same puzzle across all installs)
 *
 * Usage:  node scripts/build_daily_order.js
 */

const fs = require('fs/promises');
const path = require('path');

const PUZZLES_FILE = path.resolve(__dirname, '..', 'src', 'data', 'puzzles.json');
const DAILY_ORDER_FILE = path.resolve(__dirname, '..', 'src', 'data', 'dailyOrder.json');
const SEED = 'knotquite-daily-v1';

// Seeded random number generator (deterministic)
class SeededRandom {
  constructor(seed) {
    // Simple hash-based PRNG; produces same sequence for same seed
    this.state = 0;
    for (let i = 0; i < seed.length; i++) {
      this.state = ((this.state << 5) - this.state) + seed.charCodeAt(i);
      this.state = this.state & this.state; // 32-bit int
    }
  }

  next() {
    // Linear congruential generator
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

(async () => {
  console.log('Building daily puzzle order...');

  // Load puzzles
  let puzzles;
  try {
    const content = await fs.readFile(PUZZLES_FILE, 'utf8');
    puzzles = JSON.parse(content);
  } catch (e) {
    console.error(`Error reading ${PUZZLES_FILE}:`, e.message);
    process.exit(1);
  }

  if (!Array.isArray(puzzles) || puzzles.length === 0) {
    console.error('No puzzles found');
    process.exit(1);
  }

  // Extract IDs and shuffle deterministically
  const ids = puzzles.map(p => p.id);
  console.log(`Loaded ${ids.length} puzzle IDs: ${ids.slice(0, 5).join(', ')}${ids.length > 5 ? '...' : ''}`);

  const shuffledIds = shuffleWithSeed(ids, SEED);
  console.log(`Shuffled (seed: "${SEED}")`);

  // Load existing order (if any) to preserve tail
  let existingOrder = [];
  try {
    const existing = await fs.readFile(DAILY_ORDER_FILE, 'utf8');
    existingOrder = JSON.parse(existing);
  } catch (e) {
    // File doesn't exist yet
  }

  if (existingOrder.length > 0) {
    console.log(`\nPrevious order had ${existingOrder.length} IDs`);
    const oldIds = new Set(existingOrder);
    const newIds = shuffledIds.filter(id => !oldIds.has(id));
    console.log(`${newIds.length} new IDs to append`);

    // Append new IDs to preserve existing mapping
    const finalOrder = [...existingOrder, ...newIds];
    await fs.writeFile(DAILY_ORDER_FILE, JSON.stringify(finalOrder, null, 2), 'utf8');
    console.log(`Wrote ${finalOrder.length} IDs to ${DAILY_ORDER_FILE}`);
  } else {
    // First time: use full shuffled order
    await fs.writeFile(DAILY_ORDER_FILE, JSON.stringify(shuffledIds, null, 2), 'utf8');
    console.log(`Wrote ${shuffledIds.length} IDs to ${DAILY_ORDER_FILE}`);
  }

  console.log('\nVerifying order properties...');
  const order = JSON.parse(await fs.readFile(DAILY_ORDER_FILE, 'utf8'));
  const orderSet = new Set(order);
  console.log(`- Total IDs: ${order.length}`);
  console.log(`- Unique IDs: ${orderSet.size}`);
  if (orderSet.size === order.length) {
    console.log('✓ No duplicates');
  } else {
    console.warn('✗ WARNING: Found duplicate IDs in order!');
  }

  console.log('\nDaily order ready. Use dailyOrder.json with epoch-based indexing:');
  console.log('  daysSinceEpoch = Math.floor((today - epochDate) / 86400000)');
  console.log('  puzzleId = dailyOrder[daysSinceEpoch % dailyOrder.length]');
})();
