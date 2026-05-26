#!/bin/bash
# Simplified migration script using SQLite command-line tool
# No Node.js dependencies required

# Configuration
DB_PATH="../scrapping/xwordinfo_db/nytcrosswordarchive.db"
D1_DB_NAME="crossword_archive"
BATCH_SIZE=5000 # Increased batch size for faster migration
SCRIPT_DIR="$(dirname "$0")"
TEMP_DIR="${SCRIPT_DIR}/temp"

# Create temp directory if it doesn't exist
mkdir -p "$TEMP_DIR"

echo "Starting migration from SQLite to Cloudflare D1..."

# Apply initial schema
echo "Applying database schema..."
npx wrangler@4 d1 execute "$D1_DB_NAME" --file="../migrations/0000_initial_migration.sql"

# Get counts for progress tracking
echo "Counting records in source database..."
PUZZLE_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM puzzles;")
CLUE_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM clues;")
echo "Found $PUZZLE_COUNT puzzles and $CLUE_COUNT clues to migrate."

# Migrate puzzles
echo "Migrating puzzles..."
sqlite3 "$DB_PATH" <<EOF
.mode insert puzzles
.output ${TEMP_DIR}/puzzles_export.sql
SELECT * FROM puzzles;
.quit
EOF

# Import puzzles to D1
echo "Importing puzzles to D1..."
npx wrangler@4 d1 execute "$D1_DB_NAME" --file="${TEMP_DIR}/puzzles_export.sql"

# Create indexes for faster querying
echo "Creating indexes..."
sqlite3 "$DB_PATH" <<EOF
.output ${TEMP_DIR}/puzzle_ids.txt
SELECT DISTINCT puzzle_id FROM puzzles ORDER BY puzzle_id;
.quit
EOF

# Migrate clues by puzzle ID groups for better performance
echo "Migrating clues in batches of $BATCH_SIZE..."
readarray -t PUZZLE_IDS < "${TEMP_DIR}/puzzle_ids.txt"
TOTAL_PUZZLES=${#PUZZLE_IDS[@]}
PUZZLE_BATCH_SIZE=10
PROCESSED=0

for ((i=0; i<TOTAL_PUZZLES; i+=PUZZLE_BATCH_SIZE)); do
  end=$((i + PUZZLE_BATCH_SIZE))
  if [ $end -gt $TOTAL_PUZZLES ]; then
    end=$TOTAL_PUZZLES
  fi
  
  # Create a list of puzzle IDs for this batch
  PUZZLE_ID_LIST=""
  for ((j=i; j<end; j++)); do
    if [ -n "$PUZZLE_ID_LIST" ]; then
      PUZZLE_ID_LIST="${PUZZLE_ID_LIST},"
    fi
    PUZZLE_ID_LIST="${PUZZLE_ID_LIST}${PUZZLE_IDS[$j]}"
  done
  
  # Export clues for this group of puzzle IDs
  CURRENT_BATCH="${TEMP_DIR}/clues_batch_${i}.sql"
  echo "Exporting clues for puzzles $((i+1))-$end of $TOTAL_PUZZLES..."
  
  sqlite3 "$DB_PATH" <<EOF
.mode insert clues
.output $CURRENT_BATCH
SELECT * FROM clues WHERE puzzle_id IN ($PUZZLE_ID_LIST);
.quit
EOF

  # Count clues in this batch
  BATCH_CLUES=$(grep -c "INSERT INTO clues" "$CURRENT_BATCH" || echo 0)
  
  if [ $BATCH_CLUES -gt 0 ]; then
    echo "Importing $BATCH_CLUES clues to D1..."
    npx wrangler@4 d1 execute "$D1_DB_NAME" --file="$CURRENT_BATCH"
    
    PROCESSED=$((PROCESSED + BATCH_CLUES))
    echo "Progress: $PROCESSED/$CLUE_COUNT clues ($(( PROCESSED * 100 / CLUE_COUNT ))%)"
  fi
done

# Verify migration
echo "Verifying migration..."
D1_PUZZLE_COUNT=$(npx wrangler@4 d1 execute "$D1_DB_NAME" --command="SELECT COUNT(*) FROM puzzles;" --json | grep -o '"results":\[\[{"count":[0-9]*' | grep -o '[0-9]*$')
D1_CLUE_COUNT=$(npx wrangler@4 d1 execute "$D1_DB_NAME" --command="SELECT COUNT(*) FROM clues;" --json | grep -o '"results":\[\[{"count":[0-9]*' | grep -o '[0-9]*$')

echo "Migration complete!"
echo "Source database: $PUZZLE_COUNT puzzles, $CLUE_COUNT clues"
echo "D1 database: $D1_PUZZLE_COUNT puzzles, $D1_CLUE_COUNT clues"

# Clean up temporary files
echo "Cleaning up temporary files..."
rm -rf "$TEMP_DIR"

echo "Done!" 