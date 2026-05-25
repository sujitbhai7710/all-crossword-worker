-- Create table for crossword puzzles
CREATE TABLE IF NOT EXISTS puzzles (
    puzzle_id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    formatted_date TEXT,
    title TEXT,
    author TEXT,
    editor TEXT,
    day_of_week TEXT,
    permalink TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create table for clues
CREATE TABLE IF NOT EXISTS clues (
    clue_id INTEGER PRIMARY KEY AUTOINCREMENT,
    puzzle_id INTEGER,
    number INTEGER,
    direction TEXT,
    clue_text TEXT,
    answer TEXT,
    FOREIGN KEY (puzzle_id) REFERENCES puzzles (puzzle_id)
);

-- Create index on puzzle_id to speed up queries
CREATE INDEX IF NOT EXISTS idx_clues_puzzle_id ON clues(puzzle_id);

-- Create index on direction to speed up filtering
CREATE INDEX IF NOT EXISTS idx_clues_direction ON clues(direction);

-- Create index on answer to speed up answer searches
CREATE INDEX IF NOT EXISTS idx_clues_answer ON clues(answer);

-- Create index on clue_text to make text searches faster
CREATE INDEX IF NOT EXISTS idx_clues_text ON clues(clue_text); 