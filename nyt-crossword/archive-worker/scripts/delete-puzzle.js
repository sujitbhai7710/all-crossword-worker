#!/usr/bin/env node

/**
 * Delete a puzzle entry from the D1 database by date.
 * 
 * Usage:
 * npx wrangler d1 execute crossword_archive --file=./scripts/delete-puzzle.sql --param=2025-05-14
 * 
 * Or run this file directly (requires Wrangler to be installed):
 * node ./scripts/delete-puzzle.js 2025-05-14
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get date from command line argument
const date = process.argv[2];
if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
  console.error('Please provide a date in YYYY-MM-DD format');
  console.error('Example: node delete-puzzle.js 2025-05-14');
  process.exit(1);
}

// Create temporary SQL file
const tempSqlFile = path.join(__dirname, 'temp-delete.sql');

// SQL to delete puzzle and associated clues
const sql = `
-- Get the puzzle_id for the specified date
SELECT puzzle_id FROM puzzles WHERE date = ?1;

-- Delete clues for the puzzle
DELETE FROM clues 
WHERE puzzle_id IN (SELECT puzzle_id FROM puzzles WHERE date = ?1);

-- Delete the puzzle
DELETE FROM puzzles WHERE date = ?1;
`;

// Write SQL to temporary file
fs.writeFileSync(tempSqlFile, sql);

try {
  // Execute the command
  console.log(`Deleting puzzle for date: ${date}`);
  const output = execSync(
    `npx wrangler d1 execute crossword_archive --file=${tempSqlFile} --param=${date}`,
    { encoding: 'utf8' }
  );
  console.log(output);
  console.log(`Successfully deleted puzzle for date: ${date}`);
} catch (error) {
  console.error('Error deleting puzzle:', error.message);
} finally {
  // Clean up temporary file
  if (fs.existsSync(tempSqlFile)) {
    fs.unlinkSync(tempSqlFile);
    console.log('Cleaned up temporary files');
  }
} 