-- Delete a puzzle and its associated clues by date
-- Usage: npx wrangler d1 execute crossword_archive --file=./scripts/delete-puzzle.sql --param=2025-05-14

-- Get the puzzle_id for the specified date
SELECT puzzle_id FROM puzzles WHERE date = ?1;

-- Delete clues for the puzzle (foreign key constraint requires deleting these first)
DELETE FROM clues 
WHERE puzzle_id IN (SELECT puzzle_id FROM puzzles WHERE date = ?1);

-- Delete the puzzle entry
DELETE FROM puzzles WHERE date = ?1; 