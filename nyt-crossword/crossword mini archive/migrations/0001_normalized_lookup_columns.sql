ALTER TABLE clues ADD COLUMN clue_norm TEXT;
ALTER TABLE clues ADD COLUMN answer_norm TEXT;
ALTER TABLE clues ADD COLUMN answer_len INTEGER;

UPDATE clues
SET
    clue_norm = LOWER(
        TRIM(
            REPLACE(
                REPLACE(
                    REPLACE(
                        REPLACE(
                            REPLACE(RTRIM(COALESCE(clue, ''), ': '), CHAR(13), ' '),
                            CHAR(10),
                            ' '
                        ),
                        '  ',
                        ' '
                    ),
                    '  ',
                    ' '
                ),
                '  ',
                ' '
            )
        )
    ),
    answer_norm = UPPER(REPLACE(COALESCE(answer, ''), ' ', '')),
    answer_len = LENGTH(UPPER(REPLACE(COALESCE(answer, ''), ' ', '')))
WHERE clue_norm IS NULL
   OR answer_norm IS NULL
   OR answer_len IS NULL;

CREATE INDEX IF NOT EXISTS idx_clues_clue_norm ON clues(clue_norm);
CREATE INDEX IF NOT EXISTS idx_clues_answer_norm ON clues(answer_norm);
CREATE INDEX IF NOT EXISTS idx_clues_answer_len_norm ON clues(answer_len, answer_norm);

PRAGMA optimize;
