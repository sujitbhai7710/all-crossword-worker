# Deployment Guide for Crossword Archive Worker

This guide walks you through deploying the Crossword Archive API to Cloudflare Workers with a D1 database.

## Prerequisites

1. Node.js (v16+) installed on your machine
2. A Cloudflare account
3. Wrangler CLI installed (`npm install -g wrangler@4`)
4. The SQLite database with crossword data (`scrapping/xwordinfo_db/nytcrosswordarchive.db`)
5. SQLite command-line tool installed (recommended for migration)

## Step 1: Login to Cloudflare

Run the following command to authenticate with your Cloudflare account:

```bash
npx wrangler@4 login
```

This will open a browser window where you'll need to log in and authorize Wrangler.

## Step 2: Create the D1 Database

Create a new D1 database on Cloudflare:

```bash
npx wrangler@4 d1 create crossword_archive
```

This will output something like:

```
✅ Successfully created DB 'crossword_archive' (ID: d1234567-abcd-efgh-ijkl-mnopqrstuvwx)
```

The database ID should be automatically updated in your `wrangler.toml` file. If not, manually update it:

```toml
[[d1_databases]]
binding = "DB"
database_name = "crossword_archive"
database_id = "d1234567-abcd-efgh-ijkl-mnopqrstuvwx" # Replace with your actual DB ID
```

## Step 3: Install Dependencies

Install the project dependencies:

```bash
cd archive-worker
npm install
```

## Step 4: Apply Database Migration

Create the initial schema in your D1 database:

```bash
npx wrangler@4 d1 execute crossword_archive --file=migrations/0000_initial_migration.sql
```

## Step 5: Migrate Data from SQLite

There are several ways to migrate data from your SQLite database to Cloudflare D1. Choose the method that works best for your environment:

### Option 1: Optimized Bulk Migration (RECOMMENDED)

This is the fastest method, processing data in optimized large batches:

```bash
npm run migrate:bulk
```

### Option 2: Node.js Migration

```bash
npm run migrate
```

### Option 3: Shell Script Migration (Unix/Mac/Linux or Git Bash on Windows)

```bash
npm run migrate:shell
# or directly
bash scripts/migrate.sh
```

### Option 4: Batch Script Migration (Windows)

For Windows users:

```bash
npm run migrate:batch
# or directly
scripts\migrate.bat
```

### Option 5: Manual Migration

If you encounter issues with the automated approaches, follow the manual migration steps in `scripts/manual-migration.md`.

The migration process may take some time depending on the amount of data in your SQLite database.

## Step 6: Deploy the Worker

Deploy the Cloudflare Worker:

```bash
npm run deploy
```

Once completed, you'll get a URL for your worker (something like `https://crossword-archive-worker.your-username.workers.dev`).

## Step 7: Test Your Deployment

You can test your API using the provided example page:

1. Open `example/index.html`
2. Update the `API_BASE_URL` variable with your worker's URL
3. Open the HTML file in a browser
4. Try the different API endpoints to search and retrieve crossword data

## Troubleshooting

### Slow Migration

If the migration is progressing too slowly:
- Try the optimized bulk migration method (`npm run migrate:bulk`)
- Increase the batch size in the migration script (find the `BATCH_SIZE` constant)
- Consider migrating only a subset of puzzles for testing
- Try running the migration on a machine with a faster internet connection

### Wrangler Version

You should use Wrangler version 4 or later:
```bash
npm install -g wrangler@4
```

If you see warnings about the Wrangler version, our scripts already use `wrangler@4` but you may want to update your global installation.

### Installation Issues

- If you encounter errors related to native module compilation (like for SQLite or better-sqlite3), it may be because:
  - You're missing Visual Studio build tools on Windows
  - You don't have Python installed
  - You're using an incompatible Node.js version

  To resolve these issues:
  - Use one of the alternative migration methods (shell script, batch script, or manual migration)
  - Use `sqlite3` instead of `better-sqlite3` as we've configured
  - If needed, you can install the Windows build tools with: `npm install --global --production windows-build-tools`
  - Try using an LTS version of Node.js (v18 or v20) instead of the latest version

### Database Size Limits

- Free Cloudflare D1 databases have a size limit of 500MB. If your crossword data exceeds this, consider upgrading to a paid plan or filtering the data during migration.

### Rate Limits

- Free Cloudflare Workers have a rate limit of 100,000 requests per day. If you need more, consider upgrading to a paid plan.

### Migration Issues

- If the migration script fails, try running it with a smaller batch size by modifying the `BATCH_SIZE` constant in the migration scripts.
- You can also run the migration in smaller steps by modifying the puzzleIds array in the script to include only a subset of all puzzles.
- For very large databases, consider migrating just a subset of puzzles for testing.

### CORS Issues

If your frontend application encounters CORS issues when trying to access the API:
1. Verify that the Worker's CORS headers are correctly set (they should be by default)
2. Test with a simple standalone HTML page like the provided example 