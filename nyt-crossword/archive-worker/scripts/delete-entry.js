const { D1Database } = require('@cloudflare/workers-types');
const wrangler = require('wrangler');

/**
 * Delete a specific puzzle entry from the database
 */
async function deletePuzzleEntry() {
  try {
    console.log('Connecting to D1 database...');
    
    // Get D1 database binding
    const db = await wrangler.d1('crossword_archive');
    
    // The date of the puzzle to delete
    const dateToDelete = "2025-05-14";
    
    // First, find the puzzle ID
    const puzzleResult = await db.prepare(
      `SELECT puzzle_id FROM puzzles WHERE date = ?`
    ).bind(dateToDelete).first();
    
    if (!puzzleResult) {
      console.log(`No puzzle found for date: ${dateToDelete}`);
      return;
    }
    
    const puzzleId = puzzleResult.puzzle_id;
    console.log(`Found puzzle ID ${puzzleId} for date ${dateToDelete}`);
    
    // Delete the clues first (foreign key constraint)
    const deleteCluesResult = await db.prepare(
      `DELETE FROM clues WHERE puzzle_id = ?`
    ).bind(puzzleId).run();
    
    console.log(`Deleted ${deleteCluesResult.changes} clues`);
    
    // Then delete the puzzle
    const deletePuzzleResult = await db.prepare(
      `DELETE FROM puzzles WHERE puzzle_id = ?`
    ).bind(puzzleId).run();
    
    console.log(`Deleted puzzle entry: ${deletePuzzleResult.changes} row(s) affected`);
    
    console.log('Deletion completed successfully.');
  } catch (error) {
    console.error('Error deleting puzzle entry:', error);
  }
}

deletePuzzleEntry(); 