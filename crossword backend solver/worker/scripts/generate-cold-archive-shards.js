#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function normalizeClueForLookup(text) {
  return String(text || '')
    .replace(/<[^>]*>/g, '')
    .replace(/:\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeAnswerForLookup(text) {
  return String(text || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .trim();
}

function sha1Prefix(value) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 2);
}

function walkJsonFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkJsonFiles(fullPath, acc);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
      acc.push(fullPath);
    }
  }

  return acc;
}

function pushShardEntry(store, key, value) {
  const prefix = sha1Prefix(key);
  if (!store.has(prefix)) {
    store.set(prefix, { version: 1, entries: {} });
  }

  const shard = store.get(prefix);
  if (!shard.entries[key]) {
    shard.entries[key] = [];
  }

  shard.entries[key].push(value);
}

function extractDirectionalEntries(puzzle) {
  const entries = [];
  const date = puzzle.date || puzzle.publication_date || puzzle.publicationDate || null;
  const title = puzzle.title || puzzle?.puzzle?.title || 'New York Times Crossword';

  const addEntry = (direction, number, clue, answer) => {
    const clueNorm = normalizeClueForLookup(clue);
    const answerNorm = normalizeAnswerForLookup(answer);

    if (!clueNorm || !answerNorm || !date) {
      return;
    }

    entries.push({
      date,
      title,
      direction,
      number: number ?? null,
      clue_text: String(clue).trim(),
      answer: answerNorm,
      answer_norm: answerNorm,
    });
  };

  if (Array.isArray(puzzle?.clues?.across) && Array.isArray(puzzle?.answers?.across)) {
    puzzle.clues.across.forEach((clue, index) => {
      addEntry('across', null, clue, puzzle.answers.across[index]);
    });
  }

  if (Array.isArray(puzzle?.clues?.down) && Array.isArray(puzzle?.answers?.down)) {
    puzzle.clues.down.forEach((clue, index) => {
      addEntry('down', null, clue, puzzle.answers.down[index]);
    });
  }

  const acrossMap = puzzle?.data?.across || puzzle?.across || null;
  if (acrossMap && typeof acrossMap === 'object' && !Array.isArray(acrossMap)) {
    for (const [number, value] of Object.entries(acrossMap)) {
      addEntry('across', number, value.clue, value.answer);
    }
  }

  const downMap = puzzle?.data?.down || puzzle?.down || null;
  if (downMap && typeof downMap === 'object' && !Array.isArray(downMap)) {
    for (const [number, value] of Object.entries(downMap)) {
      addEntry('down', number, value.clue, value.answer);
    }
  }

  return entries;
}

function writeShards(baseDir, folderName, store) {
  const outputDir = path.join(baseDir, folderName);
  fs.mkdirSync(outputDir, { recursive: true });

  for (const [prefix, shard] of store.entries()) {
    const targetPath = path.join(outputDir, `${prefix}.json`);
    fs.writeFileSync(targetPath, JSON.stringify(shard));
  }
}

function main() {
  const [inputDir, outputDir] = process.argv.slice(2);

  if (!inputDir || !outputDir) {
    console.error('Usage: node scripts/generate-cold-archive-shards.js <inputDir> <outputDir>');
    process.exit(1);
  }

  if (!fs.existsSync(inputDir)) {
    console.error(`Input directory does not exist: ${inputDir}`);
    process.exit(1);
  }

  const clueStore = new Map();
  const answerStore = new Map();
  const files = walkJsonFiles(inputDir);
  let entryCount = 0;

  for (const filePath of files) {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const entries = extractDirectionalEntries(raw);

    for (const entry of entries) {
      const clueNorm = normalizeClueForLookup(entry.clue_text);
      const answerNorm = entry.answer_norm;

      pushShardEntry(clueStore, clueNorm, entry);
      pushShardEntry(answerStore, answerNorm, entry);
      entryCount += 1;
    }
  }

  fs.mkdirSync(outputDir, { recursive: true });
  writeShards(outputDir, 'clue', clueStore);
  writeShards(outputDir, 'answer', answerStore);

  fs.writeFileSync(
    path.join(outputDir, 'manifest.json'),
    JSON.stringify({
      version: 1,
      generated_at: new Date().toISOString(),
      input_files: files.length,
      entries: entryCount,
      clue_shards: clueStore.size,
      answer_shards: answerStore.size,
    }, null, 2)
  );

  console.log(`Generated ${entryCount} entries from ${files.length} files into ${outputDir}`);
}

main();
