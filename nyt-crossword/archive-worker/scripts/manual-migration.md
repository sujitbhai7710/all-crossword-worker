# Manual Database Migration Guide

If you encounter issues with the automated migration script due to SQLite dependencies, you can use this manual approach to migrate your data to Cloudflare D1.

## Prerequisites

1. SQLite command-line tool installed (usually comes with most operating systems)
2. Access to your SQLite database file (`scrapping/xwordinfo_db/nytcrosswordarchive.db`)
3. Wrangler CLI installed and authenticated with Cloudflare

## Step 1: Export Data from SQLite

### Export Puzzles to SQL File

Run this command to export puzzles to an SQL file:

```bash
sqlite3 ../scrapping/xwordinfo_db/nytcrosswordarchive.db <<EOF
.mode insert puzzles
.output puzzles_export.sql
SELECT * FROM puzzles;
.quit
EOF
```

### Export Clues in Batches

Since there may be many clues, export them in batches. Here's how to export the first 1000 clues:

```bash
sqlite3 ../scrapping/xwordinfo_db/nytcrosswordarchive.db <<EOF
.mode insert clues
.output clues_export_1.sql
SELECT * FROM clues LIMIT 1000;
.quit
EOF
```

For the next 1000 clues:

```bash
sqlite3 ../scrapping/xwordinfo_db/nytcrosswordarchive.db <<EOF
.mode insert clues
.output clues_export_2.sql
SELECT * FROM clues LIMIT 1000 OFFSET 1000;
.quit
EOF
```

Continue this pattern for all your clues, incrementing the OFFSET by 1000 each time.

## Step 2: Import Data to Cloudflare D1

### Apply Migration Schema

First, apply the database schema:

```bash
npx wrangler d1 execute crossword_archive --file=../migrations/0000_initial_migration.sql
```

### Import Puzzles Data

```bash
npx wrangler d1 execute crossword_archive --file=puzzles_export.sql
```

### Import Clues Data in Batches

Import each batch of clues:

```bash
npx wrangler d1 execute crossword_archive --file=clues_export_1.sql
npx wrangler d1 execute crossword_archive --file=clues_export_2.sql
# ... and so on for each batch
```

## Alternative: Direct SQL Export and Import

If the above method doesn't work, you can try a direct SQL dump:

```bash
# Export from SQLite to SQL file
sqlite3 ../scrapping/xwordinfo_db/nytcrosswordarchive.db .dump > full_dump.sql

# Edit the dump file to remove any SQLite-specific commands
# Then import to D1
npx wrangler d1 execute crossword_archive --file=full_dump.sql
```

Note: You may need to manually edit the SQL dump file to make it compatible with Cloudflare D1's SQL dialect.

## Verification

After importing data, verify that everything was correctly migrated:

```bash
# Check number of puzzles
npx wrangler d1 execute crossword_archive --command="SELECT COUNT(*) FROM puzzles"

# Check number of clues
npx wrangler d1 execute crossword_archive --command="SELECT COUNT(*) FROM clues"
```

These counts should match the original database. 