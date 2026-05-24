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

CREATE TABLE IF NOT EXISTS clues (
    clue_id INTEGER PRIMARY KEY AUTOINCREMENT,
    puzzle_id INTEGER,
    number INTEGER,
    direction TEXT,
    clue_text TEXT,
    answer TEXT,
    FOREIGN KEY (puzzle_id) REFERENCES puzzles (puzzle_id)
);

CREATE INDEX IF NOT EXISTS idx_clues_puzzle_id ON clues(puzzle_id);
CREATE INDEX IF NOT EXISTS idx_clues_direction ON clues(direction);
CREATE INDEX IF NOT EXISTS idx_clues_answer ON clues(answer);
CREATE INDEX IF NOT EXISTS idx_clues_text ON clues(clue_text);
