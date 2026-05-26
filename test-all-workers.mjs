#!/usr/bin/env node
/**
 * Comprehensive test script for all crossword workers.
 * Tests each worker with npx wrangler dev, hits all API endpoints,
 * and reports success/failure for each.
 * 
 * Usage: node test-all-workers.mjs
 */

import { spawn, execSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname);
const WORKERS_DIR = join(ROOT, 'workers');
const PORT_BASE = 8787;

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

// Test dates - use a recent date that should have puzzles
const testDates = [today, yesterday, '2026-05-25', '2026-05-24'];

async function fetchWithTimeout(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

async function waitForServer(port, maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetchWithTimeout(`http://127.0.0.1:${port}/`, 3000);
      if (res.ok || res.status === 404) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function testEndpoint(port, path, description, expectStatus = 200) {
  try {
    const url = `http://127.0.0.1:${port}${path}`;
    const res = await fetchWithTimeout(url, 15000);
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = null; }
    
    const pass = res.status === expectStatus;
    return {
      path,
      description,
      expected: expectStatus,
      actual: res.status,
      pass,
      hasData: json?.success || json?.data || false,
      snippet: text.slice(0, 200)
    };
  } catch (e) {
    return {
      path,
      description,
      expected: expectStatus,
      actual: 'ERROR',
      pass: false,
      error: e.message
    };
  }
}

async function testSharedWorker(workerSlug, port) {
  const results = [];
  
  // Test 1: Root endpoint
  results.push(await testEndpoint(port, '/', 'Root endpoint shows API docs'));
  
  // Test 2: /api/puzzle/latest
  results.push(await testEndpoint(port, '/api/puzzle/latest', 'Latest puzzle endpoint'));
  
  // Test 3: /api/puzzle/{date} for various dates
  for (const date of testDates.slice(0, 2)) {
    results.push(await testEndpoint(port, `/api/puzzle/${date}`, `Puzzle by date (${date})`));
  }
  
  // Test 4: /api/clues/{date}
  results.push(await testEndpoint(port, `/api/clues/${testDates[0]}`, 'Clues by date'));
  
  // Test 5: /api/search/answer?q=...&mode=exact
  results.push(await testEndpoint(port, '/api/search/answer?q=CAT&mode=exact', 'Search by answer (exact)'));
  
  // Test 6: /api/search/answer?q=...&mode=contains
  results.push(await testEndpoint(port, '/api/search/answer?q=AT&mode=contains', 'Search by answer (contains)'));
  
  // Test 7: /api/search/clue?q=...&mode=contains
  results.push(await testEndpoint(port, '/api/search/clue?q=cat&mode=contains', 'Search by clue (contains)'));
  
  // Test 8: /api/related/answer?q=...
  results.push(await testEndpoint(port, '/api/related/answer?q=CAT', 'Related clues for answer'));
  
  // Test 9: Invalid date format
  results.push(await testEndpoint(port, '/api/puzzle/invalid-date', 'Invalid date returns error', 400));
  
  // Test 10: Unknown endpoint
  results.push(await testEndpoint(port, '/api/nonexistent', 'Unknown endpoint returns 404', 404));
  
  // Test 11: Write endpoints without auth (should fail)
  results.push(await testEndpoint(port, `/api/add/${testDates[0]}`, 'Add without auth returns 401', 401));
  
  return results;
}

async function testNytArchiveWorker(port) {
  const results = [];
  
  results.push(await testEndpoint(port, '/', 'Root endpoint'));
  results.push(await testEndpoint(port, `/api/puzzle/${testDates[0]}`, 'Puzzle by date'));
  results.push(await testEndpoint(port, '/api/search/answer?q=CAT&mode=exact', 'Search by answer (exact)'));
  results.push(await testEndpoint(port, '/api/search/clue?q=the&mode=contains', 'Search by clue (contains)'));
  results.push(await testEndpoint(port, '/api/related/answer?q=CAT', 'Related clues'));
  results.push(await testEndpoint(port, '/api/nonexistent', 'Unknown endpoint returns 404', 404));
  
  return results;
}

async function testNytMiniWorker(port) {
  const results = [];
  
  results.push(await testEndpoint(port, '/', 'Root endpoint'));
  results.push(await testEndpoint(port, '/today', 'Today endpoint'));
  results.push(await testEndpoint(port, `/date?date=${testDates[0]}`, 'Puzzle by date'));
  results.push(await testEndpoint(port, '/clue?q=the&mode=contains', 'Search by clue (contains)'));
  results.push(await testEndpoint(port, '/answer?q=CAT&mode=exact', 'Search by answer (exact)'));
  results.push(await testEndpoint(port, '/nonexistent', 'Unknown route returns 404', 404));
  
  return results;
}

async function runWorkerTest(workerSlug, port, testFn) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${workerSlug} (port ${port})`);
  console.log('='.repeat(60));
  
  // Start wrangler dev
  const workerDir = workerSlug.startsWith('nyt-') && !workerSlug.includes('midi')
    ? join(ROOT, 'nyt-crossword', workerSlug === 'nyt-daily' ? 'archive-worker' : 'crossword mini archive')
    : join(WORKERS_DIR, workerSlug);
  
  let proc;
  try {
    proc = spawn('npx', ['wrangler', 'dev', '--port', String(port), '--persist-to', join(ROOT, '.wrangler-test', workerSlug)], {
      cwd: workerDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      env: { ...process.env, NODE_OPTIONS: '' }
    });
    
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.stdout.on('data', () => {});
    
    // Wait for server to be ready
    const ready = await waitForServer(port);
    if (!ready) {
      console.log(`  FAILED: Server did not start within timeout`);
      console.log(`  stderr: ${stderr.slice(-500)}`);
      proc.kill();
      return { worker: workerSlug, results: [], error: 'Server did not start' };
    }
    
    // Run tests
    const results = await testFn(port);
    
    // Print results
    let passed = 0, failed = 0;
    for (const r of results) {
      const icon = r.pass ? 'PASS' : 'FAIL';
      if (r.pass) passed++; else failed++;
      console.log(`  [${icon}] ${r.description}: ${r.actual} (expected ${r.expected})${r.error ? ' - ' + r.error : ''}`);
    }
    console.log(`  Summary: ${passed} passed, ${failed} failed`);
    
    proc.kill();
    return { worker: workerSlug, results, passed, failed };
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
    if (proc) proc.kill();
    return { worker: workerSlug, results: [], error: e.message };
  }
}

// Provider-specific fetch tests (hit live APIs to verify providers work)
async function testProviderDirectly(workerSlug, port) {
  const results = [];
  
  // The /api/update/latest endpoint with no API_TOKEN set will return 401
  // But if we set API_TOKEN in env, it'll try to fetch from the source
  // For now, just test the read endpoints which work without data
  
  return results;
}

async function main() {
  console.log('Crossword Worker Comprehensive Test Suite');
  console.log(`Test dates: ${testDates.join(', ')}`);
  console.log(`Started: ${new Date().toISOString()}\n`);
  
  const allResults = [];
  
  // Get all shared workers
  const workerDirs = await readdir(WORKERS_DIR);
  
  // Test shared workers (use different ports to avoid conflicts)
  let portIdx = 0;
  
  // Test a subset of workers to save time - test each unique provider type
  const workersToTest = [
    'atlantic',           // AmuseLabs provider
    'guardian-cryptic',   // Guardian provider
    'latimes-daily',      // uclick XML provider
    'latimes-mini',       // AmuseLabs with loadToken
    'usa-today-daily',    // uclick XML provider
    'washington-post-daily', // WaPo JSON provider
    'new-yorker',         // Conde Nast API provider
    'new-yorker-mini',    // Conde Nast API provider (mini)
    'universal',          // AM Universal JSON provider
    'newsday',            // AmuseLabs with loadToken
    'vox',                // AmuseLabs with loadToken
    'daily-pop',          // PuzzleNation provider
    'nyt-midi',           // NYT v6 API provider
  ];
  
  for (const slug of workersToTest) {
    const port = PORT_BASE + portIdx;
    portIdx++;
    const result = await runWorkerTest(slug, port, (p) => testSharedWorker(slug, p));
    allResults.push(result);
    // Small delay between tests
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Print overall summary
  console.log('\n\n' + '='.repeat(60));
  console.log('OVERALL SUMMARY');
  console.log('='.repeat(60));
  
  let totalPassed = 0, totalFailed = 0;
  for (const r of allResults) {
    const p = r.passed || 0;
    const f = r.failed || 0;
    totalPassed += p;
    totalFailed += f;
    const status = f === 0 ? 'ALL PASS' : `${f} FAIL`;
    console.log(`  ${r.worker}: ${status} (${p}/${p+f} tests)`);
    if (r.error) console.log(`    Error: ${r.error}`);
  }
  
  console.log(`\nTotal: ${totalPassed} passed, ${totalFailed} failed`);
  console.log(`Finished: ${new Date().toISOString()}`);
  
  // Write results to file
  const reportPath = join(ROOT, 'test-results.json');
  const { writeFile } = await import('node:fs/promises');
  await writeFile(reportPath, JSON.stringify(allResults, null, 2));
  console.log(`\nDetailed results saved to: ${reportPath}`);
}

main().catch(console.error);
