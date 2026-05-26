/**
 * Comprehensive test script for all crossword providers
 * Tests each provider's fetchByDate method and all API endpoints
 * Run with: node test-providers.mjs
 */

import { createAtlanticProvider } from './shared/providers/atlantic.js';
import { createLatimesDailyProvider, createLatimesMiniProvider } from './shared/providers/latimes.js';
import { createUsaTodayDailyProvider } from './shared/providers/usaToday.js';
import { createWashingtonPostDailyProvider, createWashingtonPostMiniProvider, createWashingtonPostSundayProvider } from './shared/providers/washingtonPost.js';
import { createGuardianProvider } from './shared/providers/guardian.js';
import { createNewYorkerProvider, createNewYorkerMiniProvider } from './shared/providers/newYorker.js';
import { createUniversalProvider } from './shared/providers/universal.js';
import { createNewsdayProvider } from './shared/providers/newsday.js';
import { createVoxProvider } from './shared/providers/vox.js';
import { createDailyPopProvider } from './shared/providers/dailyPop.js';

const TODAY = '2026-05-25';
const YESTERDAY = '2026-05-24';

const providers = [
  { provider: createAtlanticProvider(), dates: [TODAY] },
  { provider: createLatimesDailyProvider(), dates: [TODAY] },
  { provider: createLatimesMiniProvider(), dates: [TODAY] },
  { provider: createUsaTodayDailyProvider(), dates: [TODAY] },
  { provider: createWashingtonPostDailyProvider(), dates: [TODAY] },
  { provider: createWashingtonPostMiniProvider(), dates: [TODAY] },
  { provider: createWashingtonPostSundayProvider(), dates: ['2026-05-24'] },
  { provider: createGuardianProvider({ seriesTag: 'quick', title: 'Guardian Quick Crossword' }), dates: [YESTERDAY] },
  { provider: createGuardianProvider({ seriesTag: 'cryptic', title: 'Guardian Cryptic Crossword' }), dates: [YESTERDAY] },
  { provider: createNewYorkerProvider(), dates: [TODAY] },
  { provider: createNewYorkerMiniProvider(), dates: [TODAY] },
  { provider: createUniversalProvider(), dates: [TODAY] },
  { provider: createNewsdayProvider(), dates: [TODAY] },
  { provider: createVoxProvider(), dates: [TODAY] },
  { provider: createDailyPopProvider(), dates: [TODAY] },
];

async function testProvider(provider, date) {
  const start = Date.now();
  try {
    const puzzle = await provider.fetchByDate(date, { GUARDIAN_API_KEY: 'test' });
    const elapsed = Date.now() - start;

    const hasClues = puzzle.clues && puzzle.clues.length > 0;
    const hasAcross = puzzle.clues?.some(c => c.direction === 'across');
    const hasDown = puzzle.clues?.some(c => c.direction === 'down');
    const allHaveAnswers = puzzle.clues?.every(c => c.answer && c.answer.length > 0);
    const allHaveClueText = puzzle.clues?.every(c => c.clue_text && c.clue_text.length > 0);

    return {
      status: 'PASS',
      slug: provider.slug,
      date,
      elapsed: `${elapsed}ms`,
      title: puzzle.title || '(empty)',
      author: puzzle.author || '(empty)',
      clueCount: puzzle.clues?.length || 0,
      acrossCount: puzzle.clues?.filter(c => c.direction === 'across').length || 0,
      downCount: puzzle.clues?.filter(c => c.direction === 'down').length || 0,
      hasClues,
      hasAcross,
      hasDown,
      allHaveAnswers,
      allHaveClueText,
      sampleClue: puzzle.clues?.[0] || null,
    };
  } catch (error) {
    const elapsed = Date.now() - start;
    return {
      status: 'FAIL',
      slug: provider.slug,
      date,
      elapsed: `${elapsed}ms`,
      error: error.message,
      errorName: error.name,
    };
  }
}

console.log('='.repeat(80));
console.log('CROSSWORD PROVIDER TEST SUITE');
console.log('='.repeat(80));
console.log(`Testing ${providers.length} providers with date ${TODAY}`);
console.log('');

const results = [];

for (const { provider, dates } of providers) {
  for (const date of dates) {
    console.log(`Testing: ${provider.slug} (${date})...`);
    const result = await testProvider(provider, date);
    results.push(result);

    if (result.status === 'PASS') {
      console.log(`  ✅ PASS — ${result.clueCount} clues (${result.acrossCount}A/${result.downCount}D) in ${result.elapsed}`);
      if (!result.allHaveAnswers) console.log(`  ⚠️  NOT all clues have answers!`);
      if (!result.allHaveClueText) console.log(`  ⚠️  NOT all clues have clue text!`);
    } else {
      console.log(`  ❌ FAIL — ${result.errorName}: ${result.error?.slice(0, 100)} (${result.elapsed})`);
    }
  }
}

console.log('');
console.log('='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));

const passed = results.filter(r => r.status === 'PASS');
const failed = results.filter(r => r.status === 'FAIL');

console.log(`Total: ${results.length} | Passed: ${passed.length} | Failed: ${failed.length}`);
console.log('');

if (passed.length > 0) {
  console.log('PASSED:');
  for (const r of passed) {
    console.log(`  ${r.slug} — ${r.clueCount} clues, all answers: ${r.allHaveAnswers}, all clues: ${r.allHaveClueText}`);
  }
}

if (failed.length > 0) {
  console.log('');
  console.log('FAILED:');
  for (const r of failed) {
    console.log(`  ${r.slug} — ${r.errorName}: ${r.error?.slice(0, 150)}`);
  }
}

// Write results to file
import fs from 'fs';
fs.writeFileSync('/home/z/my-project/download/provider-test-results.json', JSON.stringify(results, null, 2));
console.log('');
console.log('Results saved to /home/z/my-project/download/provider-test-results.json');
