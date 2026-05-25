/**
 * Optimized bulk migration script for Cloudflare D1
 * Uses direct SQL export for maximum performance
 * No SQLite dependencies required
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const DB_PATH = path.join(__dirname, '../../scrapping/xwordinfo_db/nytcrosswordarchive.db');
const D1_DATABASE_NAME = 'crossword_archive';
const TEMP_DIR = path.join(__dirname, 'temp');
const MAX_SQL_FILE_SIZE = 25 * 1024 * 1024; // 25MB max file size for Cloudflare
const MIGRATIONS_FILE = path.join(__dirname, '../migrations/0000_initial_migration.sql');

// Add the remote flag to all D1 commands
const REMOTE_FLAG = '--remote';

// Make sure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

console.log('Starting optimized bulk migration to REMOTE Cloudflare D1...');

// Apply migration schema
console.log('Applying initial schema to remote database...');
execSync(`npx wrangler@4 d1 execute ${D1_DATABASE_NAME} ${REMOTE_FLAG} --file=${MIGRATIONS_FILE}`, { stdio: 'inherit' });

// Export puzzles table
console.log('Exporting puzzles table...');
execSync(`sqlite3 "${DB_PATH}" ".mode insert puzzles" ".output ${path.join(TEMP_DIR, 'puzzles.sql')}" "SELECT * FROM puzzles;" ".quit"`, { stdio: 'inherit' });

// Import puzzles data
console.log('Importing puzzles to remote D1...');
execSync(`npx wrangler@4 d1 execute ${D1_DATABASE_NAME} ${REMOTE_FLAG} --file=${path.join(TEMP_DIR, 'puzzles.sql')}`, { stdio: 'inherit' });

// Export list of puzzle IDs
console.log('Getting puzzle IDs for batch processing...');
execSync(`sqlite3 "${DB_PATH}" ".output ${path.join(TEMP_DIR, 'puzzle_ids.txt')}" "SELECT puzzle_id FROM puzzles ORDER BY puzzle_id;" ".quit"`, { stdio: 'inherit' });

// Read puzzle IDs
const puzzleIds = fs.readFileSync(path.join(TEMP_DIR, 'puzzle_ids.txt'), 'utf8')
  .split('\n')
  .filter(id => id.trim())
  .map(id => parseInt(id.trim()));

// Count total clues
const clueCount = parseInt(
  execSync(`sqlite3 "${DB_PATH}" "SELECT COUNT(*) FROM clues;"`, { encoding: 'utf8' }).trim()
);
console.log(`Found ${puzzleIds.length} puzzles and ${clueCount} clues to migrate to remote database.`);

// Process puzzles in large batches optimized for D1
const batchSize = 50; // Number of puzzles per batch
let processedClues = 0;
let currentSqlFile = 1;
let sqlFilePath = path.join(TEMP_DIR, `clues_${currentSqlFile}.sql`);

// Custom function to extract count from SQL file
function countInsertStatements(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return (content.match(/INSERT INTO clues/g) || []).length;
  } catch (err) {
    return 0;
  }
}

console.log('Exporting clues in optimized batches...');

for (let i = 0; i < puzzleIds.length; i += batchSize) {
  const batchIds = puzzleIds.slice(i, i + batchSize);
  const idList = batchIds.join(',');
  
  console.log(`Processing puzzles ${i+1} to ${Math.min(i+batchSize, puzzleIds.length)} of ${puzzleIds.length}...`);
  
  // Create a temp SQL file for this batch
  const batchFile = path.join(TEMP_DIR, `batch_${i}.sql`);
  execSync(`sqlite3 "${DB_PATH}" ".mode insert clues" ".output ${batchFile}" "SELECT * FROM clues WHERE puzzle_id IN (${idList});" ".quit"`, { stdio: 'pipe' });
  
  // Get file size
  const stats = fs.statSync(batchFile);
  const batchClues = countInsertStatements(batchFile);
  
  // If adding this batch would exceed max file size, finalize the current file and start a new one
  if (fs.existsSync(sqlFilePath) && (fs.statSync(sqlFilePath).size + stats.size) > MAX_SQL_FILE_SIZE) {
    console.log(`SQL file ${sqlFilePath} reached size limit. Starting new file.`);
    currentSqlFile++;
    sqlFilePath = path.join(TEMP_DIR, `clues_${currentSqlFile}.sql`);
  }
  
  // Append this batch to the current SQL file
  fs.appendFileSync(sqlFilePath, fs.readFileSync(batchFile, 'utf8'));
  processedClues += batchClues;
  
  // Clean up batch file
  fs.unlinkSync(batchFile);
  
  console.log(`Progress: ${processedClues}/${clueCount} clues (${Math.round((processedClues / clueCount) * 100)}%)`);
}

// Import all generated SQL files directly to remote
console.log('Importing clues to REMOTE D1 database...');
const sqlFiles = fs.readdirSync(TEMP_DIR).filter(file => file.startsWith('clues_') && file.endsWith('.sql'));

for (const file of sqlFiles) {
  const filePath = path.join(TEMP_DIR, file);
  console.log(`Importing ${file} to remote database...`);
  execSync(`npx wrangler@4 d1 execute ${D1_DATABASE_NAME} ${REMOTE_FLAG} --file=${filePath}`, { stdio: 'inherit' });
}

// Verify the migration on the remote database
console.log('Verifying remote migration...');
const d1PuzzleCount = execSync(`npx wrangler@4 d1 execute ${D1_DATABASE_NAME} ${REMOTE_FLAG} --command="SELECT COUNT(*) FROM puzzles;" --json`, { encoding: 'utf8' });
const d1ClueCount = execSync(`npx wrangler@4 d1 execute ${D1_DATABASE_NAME} ${REMOTE_FLAG} --command="SELECT COUNT(*) FROM clues;" --json`, { encoding: 'utf8' });

console.log('Remote migration complete!');
console.log(`Source database: ${puzzleIds.length} puzzles, ${clueCount} clues`);
console.log(`Remote D1 database: ${d1PuzzleCount}, ${d1ClueCount}`);

// Clean up temporary files
console.log('Cleaning up temporary files...');
fs.rmSync(TEMP_DIR, { recursive: true, force: true });

console.log('Done!'); 