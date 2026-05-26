-- Create the puzzles table for storing crossword data
CREATE TABLE IF NOT EXISTS puzzles (
  date TEXT PRIMARY KEY,
  formatted_text TEXT NOT NULL,
  extracted_data TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Create an index on the date column for faster lookups
CREATE INDEX IF NOT EXISTS idx_puzzles_date ON puzzles(date);

-- Create a table for clues to enable fast searching
CREATE TABLE IF NOT EXISTS clues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  direction TEXT NOT NULL,
  number TEXT NOT NULL,
  clue TEXT NOT NULL,
  answer TEXT NOT NULL,
  FOREIGN KEY (date) REFERENCES puzzles(date) ON DELETE CASCADE
);

-- Create indexes for efficient searching
CREATE INDEX IF NOT EXISTS idx_clues_clue ON clues(clue);
CREATE INDEX IF NOT EXISTS idx_clues_answer ON clues(answer);
CREATE INDEX IF NOT EXISTS idx_clues_date ON clues(date); 