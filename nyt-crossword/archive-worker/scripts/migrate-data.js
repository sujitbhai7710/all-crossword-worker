/**
 * Data migration script for transferring crossword data from SQLite to Cloudflare D1
 * 
 * Usage:
 * 1. Install dependencies: npm install sqlite3
 * 2. Run: npx wrangler d1 execute crossword_archive --local --file=migrations/0000_initial_migration.sql
 * 3. Run: node scripts/migrate-data.js
 * 4. Deploy: npx wrangler deploy
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const sqlite3 = require('sqlite3').verbose();

// Configuration
const SQLITE_DB_PATH = path.join(__dirname, '../../scrapping/xwordinfo_db/nytcrosswordarchive.db');
const BATCH_SIZE = 5000; // Increased batch size for faster migration
const D1_DATABASE_NAME = 'crossword_archive';
const CONCURRENCY = 3; // Number of concurrent uploads

// Main migration function
async function migrateData() {
  console.log('Starting migration from SQLite to Cloudflare D1...');
  
  try {
    // Connect to the SQLite database
    const db = new sqlite3.Database(SQLITE_DB_PATH, sqlite3.OPEN_READONLY);
    console.log('Connected to source SQLite database.');
    
    // Get counts for progress tracking
    await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM puzzles', (err, row) => {
        if (err) reject(err);
        console.log(`Found ${row.count} puzzles to migrate.`);
        resolve();
      });
    });
    
    await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM clues', (err, row) => {
        if (err) reject(err);
        console.log(`Found ${row.count} clues to migrate.`);
        resolve();
      });
    });
    
    // Migrate puzzles
    await migratePuzzles(db);
    
    // Migrate clues
    await migrateClues(db);
    
    console.log('Migration completed successfully!');
    db.close();
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Migrate puzzles table
async function migratePuzzles(db) {
  console.log('Migrating puzzles...');
  
  // Get all puzzles
  const puzzles = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM puzzles ORDER BY date', (err, rows) => {
      if (err) reject(err);
      resolve(rows);
    });
  });
  
  // Process in batches
  for (let i = 0; i < puzzles.length; i += BATCH_SIZE) {
    const batch = puzzles.slice(i, i + BATCH_SIZE);
    
    // Create SQL insert statements
    const sqlBatch = batch.map(puzzle => {
      return `INSERT INTO puzzles (puzzle_id, date, formatted_date, title, author, editor, day_of_week, permalink, created_at)
      VALUES (
        ${puzzle.puzzle_id},
        '${escape(puzzle.date)}',
        '${escape(puzzle.formatted_date)}',
        '${escape(puzzle.title)}',
        '${escape(puzzle.author)}',
        '${escape(puzzle.editor)}',
        '${escape(puzzle.day_of_week)}',
        '${escape(puzzle.permalink)}',
        '${escape(puzzle.created_at)}'
      );`;
    }).join('\n');
    
    // Write SQL to temp file
    const tempFile = path.join(__dirname, 'temp_puzzles.sql');
    fs.writeFileSync(tempFile, sqlBatch);
    
    // Execute SQL with Wrangler
    await executeD1Query(tempFile);
    
    // Clean up temp file
    fs.unlinkSync(tempFile);
    
    console.log(`Migrated puzzles ${i + 1} to ${Math.min(i + BATCH_SIZE, puzzles.length)} of ${puzzles.length}`);
  }
  
  console.log('Puzzles migration completed.');
}

// Migrate clues table
async function migrateClues(db) {
  console.log('Migrating clues...');
  
  // Get total count
  const totalCluesObj = await new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM clues', (err, row) => {
      if (err) reject(err);
      resolve(row);
    });
  });
  
  const totalClues = totalCluesObj.count;
  let processedClues = 0;
  
  // Process in batches by puzzle_id for efficiency
  const puzzleIdsObj = await new Promise((resolve, reject) => {
    db.all('SELECT puzzle_id FROM puzzles ORDER BY puzzle_id', (err, rows) => {
      if (err) reject(err);
      resolve(rows);
    });
  });
  
  const puzzleIds = puzzleIdsObj.map(p => p.puzzle_id);
  
  // Group puzzle IDs into larger chunks for processing
  const puzzleIdChunks = [];
  for (let i = 0; i < puzzleIds.length; i += 10) {
    puzzleIdChunks.push(puzzleIds.slice(i, i + 10));
  }
  
  for (const puzzleIdChunk of puzzleIdChunks) {
    // Get all clues for this chunk of puzzle IDs
    const placeholders = puzzleIdChunk.map(() => '?').join(',');
    const clues = await new Promise((resolve, reject) => {
      db.all(`SELECT * FROM clues WHERE puzzle_id IN (${placeholders})`, puzzleIdChunk, (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });
    
    // Process in larger batches
    for (let i = 0; i < clues.length; i += BATCH_SIZE) {
      const batch = clues.slice(i, i + BATCH_SIZE);
      
      // Create SQL insert statements
      const sqlBatch = batch.map(clue => {
        return `INSERT INTO clues (clue_id, puzzle_id, number, direction, clue_text, answer)
        VALUES (
          ${clue.clue_id},
          ${clue.puzzle_id},
          ${clue.number},
          '${escape(clue.direction)}',
          '${escape(clue.clue_text)}',
          '${escape(clue.answer)}'
        );`;
      }).join('\n');
      
      // Write SQL to temp file
      const tempFile = path.join(__dirname, `temp_clues_${i}.sql`);
      fs.writeFileSync(tempFile, sqlBatch);
      
      // Execute SQL with Wrangler
      await executeD1Query(tempFile);
      
      // Clean up temp file
      fs.unlinkSync(tempFile);
      
      processedClues += batch.length;
      console.log(`Migrated clues ${processedClues} of ${totalClues} (${Math.round((processedClues / totalClues) * 100)}%)`);
    }
  }
  
  console.log('Clues migration completed.');
}

// Execute SQL file with Wrangler CLI
function executeD1Query(sqlFile) {
  return new Promise((resolve, reject) => {
    const command = `npx wrangler@4 d1 execute ${D1_DATABASE_NAME} --file=${sqlFile}`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`D1 error: ${error.message}`);
        reject(error);
        return;
      }
      if (stderr && !stderr.includes('[WARNING]')) {
        console.error(`D1 stderr: ${stderr}`);
      }
      resolve(stdout);
    });
  });
}

// Helper to escape SQL strings
function escape(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/'/g, "''");
}

// Run the migration
migrateData().catch(console.error); 