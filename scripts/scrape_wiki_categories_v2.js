#!/usr/bin/env node
/**
 * Scrape random Wikipedia categories via the MediaWiki API.
 * Produces puzzle-ready groups: each group = { name, words: string[] }
 * where words are short article titles (uppercased, 1–2 words preferred).
 *
 * Key optimisations:
 *   - Uses generator=random + prop=categoryinfo to get random categories
 *     WITH member counts in a SINGLE API call (halves request count).
 *   - Only fetches members for categories that already pass all filters
 *     AND have enough pages.
 *   - 1-second delay between all requests to stay below rate limits.
 *   - Resume support: reads existing wiki_groups.json on start.
 *
 * Usage:  node scripts/scrape_wiki_categories.js [targetGroups]
 *         default targetGroups = 1000
 */

const fs = require('fs/promises');
const path = require('path');

const TARGET = parseInt(process.argv[2] || '1000', 10);
const OUT_FILE = path.resolve(__dirname, '..', 'src', 'data', 'wiki_groups.json');

const API = 'https://en.wikipedia.org/w/api.php';
const UA = 'KnotQuitePuzzleBot/1.0 (puzzle game data; contact: none)';

const RANDOM_BATCH = 50;
const CM_LIMIT = 100;
const DELAY_MS = 1000;         // 1 second between ALL API calls
const SAVE_EVERY = 25;

const MIN_MEMBERS = 4;
const MAX_WORD_LEN = 14;
const MAX_WORDS_IN_TITLE = 3;
const MAX_CAT_NAME_LEN = 60;

const BAD_CAT_PATTERNS = [
  /stubs$/i,
  /articles\s+(needing|with|lacking|containing)/i,
  /wikipedia/i, /wikidata/i, /wikimedia/i, /wikisource/i,
  /commons\s+category/i, /template/i, /navigational\s+boxes/i,
  /use\s+(dmy|mdy)\s+dates/i, /cs1/i, /webarchive/i,
  /pages\s+(using|with)/i, /short\s+description/i,
  /coordinates/i, /geobox/i, /infobox/i, /redirect/i,
  /all\s+stub/i, /cleanup/i, /accuracy\s+disputes/i,
  /living\s+people/i,
  /\d{4}\s+deaths$/i, /\d{4}\s+births$/i,
  /by\s+(year|century|decade|language)/i,
  /census/i, /constituencies/i,
];

const BAD_MEMBER_PATTERNS = [
  /^list\s+of/i, /^index\s+of/i, /^outline\s+of/i,
  /^history\s+of/i, /^glossary\s+of/i,
  /\(.+\)/,
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MAX_RETRIES = 10;
let lastRequestTime = 0;

async function apiFetch(params) {
  // Enforce minimum gap between requests globally
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < DELAY_MS) {
    await sleep(DELAY_MS - elapsed);
  }

  const url = new URL(API);
  params.format = 'json';
  params.formatversion = '2';
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    lastRequestTime = Date.now();
    const res = await fetch(url.toString(), { headers: { 'User-Agent': UA } });
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) {
      // Exponential backoff: 5s, 10s, 20s, 40s, 80s, 120s, 120s...
      const wait = Math.min(5000 * Math.pow(2, attempt), 120000);
      console.warn(`  429 — waiting ${(wait / 1000).toFixed(0)}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await sleep(wait);
      continue;
    }
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  throw new Error(`API failed after ${MAX_RETRIES} retries`);
}

/**
 * Get random categories WITH their member counts in a single request.
 * Uses generator=random in the Category namespace + prop=categoryinfo.
 * Returns [{ title, pages }]
 */
async function getRandomCategoriesWithInfo(n) {
  const data = await apiFetch({
    action: 'query',
    generator: 'random',
    grnnamespace: '14',
    grnlimit: String(Math.min(n, 50)),
    prop: 'categoryinfo',
  });
  const pages = data.query?.pages || [];
  return pages.map((p) => ({
    title: p.title,
    pages: p.categoryinfo?.pages ?? 0,
    subcats: p.categoryinfo?.subcats ?? 0,
  }));
}

async function getCategoryMembers(catTitle) {
  const data = await apiFetch({
    action: 'query',
    list: 'categorymembers',
    cmtitle: catTitle,
    cmlimit: String(CM_LIMIT),
    cmtype: 'page',
  });
  return (data.query?.categorymembers || []).map((m) => m.title);
}

function cleanCategoryName(raw) {
  return raw.replace(/^Category:/, '').trim();
}

function isBadCategory(name) {
  if (name.length > MAX_CAT_NAME_LEN) return true;
  return BAD_CAT_PATTERNS.some((re) => re.test(name));
}

function cleanMember(title) {
  if (BAD_MEMBER_PATTERNS.some((re) => re.test(title))) return null;
  let t = title.split(',')[0].trim();
  const words = t.split(/\s+/);
  if (words.length > MAX_WORDS_IN_TITLE) return null;
  if (t.length > MAX_WORD_LEN) return null;
  if (t.length < 2) return null;
  if (/\d/.test(t)) return null;
  return t.toUpperCase();
}

(async () => {
  console.log(`Target: ${TARGET} usable groups`);
  console.log(`Waiting 60s initial cooldown to clear any rate-limit...`);
  await sleep(60000);

  // Resume
  let groups = [];
  try {
    const existing = await fs.readFile(OUT_FILE, 'utf8');
    groups = JSON.parse(existing);
    if (Array.isArray(groups) && groups.length > 0) {
      console.log(`Resuming from ${groups.length} existing groups`);
    } else {
      groups = [];
    }
  } catch {
    groups = [];
  }

  const seenNames = new Set(groups.map((g) => g.name));
  let totalReqs = 0;
  let emptyRounds = 0;
  let lastSave = groups.length;
  const startTime = Date.now();

  while (groups.length < TARGET && emptyRounds < 60) {
    // 1) Single request: random categories + member counts
    let catInfos;
    try {
      catInfos = await getRandomCategoriesWithInfo(RANDOM_BATCH);
      totalReqs++;
    } catch (e) {
      console.warn(`  Error getting random categories: ${e.message}`);
      emptyRounds++;
      continue;
    }

    // 2) Filter: name check + minimum page count
    const candidates = catInfos.filter((ci) => {
      const name = cleanCategoryName(ci.title);
      if (seenNames.has(name)) return false;
      if (isBadCategory(name)) return false;
      if (ci.pages < MIN_MEMBERS) return false; // skip without fetching members
      return true;
    });

    let batchHits = 0;

    // 3) Fetch members only for good candidates (serial, 1s gap enforced)
    for (const ci of candidates) {
      if (groups.length >= TARGET) break;
      const name = cleanCategoryName(ci.title);

      let members;
      try {
        members = await getCategoryMembers(ci.title);
        totalReqs++;
      } catch (e) {
        console.warn(`  Error: ${ci.title}: ${e.message}`);
        continue;
      }

      const cleaned = [];
      const memberSet = new Set();
      for (const m of members) {
        const c = cleanMember(m);
        if (c && !memberSet.has(c)) {
          memberSet.add(c);
          cleaned.push(c);
        }
      }
      if (cleaned.length < MIN_MEMBERS) continue;

      seenNames.add(name);
      groups.push({ name, words: cleaned });
      batchHits++;
    }

    if (batchHits === 0) {
      emptyRounds++;
    } else {
      emptyRounds = 0;
    }

    // Save periodically
    if (groups.length - lastSave >= SAVE_EVERY) {
      await fs.writeFile(OUT_FILE, JSON.stringify(groups, null, 2), 'utf8');
      lastSave = groups.length;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(
      `+${batchHits} → ${groups.length}/${TARGET}  ` +
      `(${totalReqs} reqs, ${candidates.length} candidates from ${catInfos.length} random, ${elapsed}s elapsed)`
    );
  }

  console.log(`\nDone! Collected ${groups.length} groups in ${totalReqs} API calls.`);
  await fs.writeFile(OUT_FILE, JSON.stringify(groups, null, 2), 'utf8');
  console.log(`Saved to ${OUT_FILE}`);
})();
