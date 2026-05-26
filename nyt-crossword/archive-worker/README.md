# NYT Crossword Archive API

This Cloudflare Worker provides an API for accessing historical New York Times crossword puzzle data stored in a Cloudflare D1 database. It also includes endpoints for automatically scraping and updating puzzle data.

## API Endpoints

### Public Endpoints (Read-Only)

These endpoints do not require an API key and are used to retrieve puzzle data.

#### Get Puzzle by Date
- **URL**: `GET /api/puzzle/{date}`
- **Description**: Retrieves the complete puzzle data for a specific date, including all clues.
- **Parameters**: `date` in `YYYY-MM-DD` or `MM/DD/YYYY` format (or `today`).
- **Example**: `/api/puzzle/2023-01-01`

#### Get Clues by Date
- **URL**: `GET /api/clues/{date}`
- **Description**: Retrieves just the clues for a specific date's puzzle.
- **Example**: `/api/clues/2023-01-01`

#### Search by Answer
- **URL**: `GET /api/search/answer?q={answer}`
- **Description**: Searches for clues with a specific answer.
- **Example**: `/api/search/answer?q=OREO`

#### Search by Clue Text
- **URL**: `GET /api/search/clue?q={clue_text}`
- **Description**: Searches for clues containing specific text.
- **Example**: `/api/search/clue?q=Famous cookie`

#### Get Related Clues
- **URL**: `GET /api/related/answer?q={answer}`
- **Description**: Retrieves all related clues for a specific answer across multiple puzzles.
- **Example**: `/api/related/answer?q=OREO`

---

### Protected Endpoints (Write/Admin)

These endpoints require a valid `API_KEY`. You can provide the key as the last part of the URL path.

#### Add Today's Puzzle (Simple)
- **URL**: `GET /today/add/{apiKey}`
- **Description**: Scrapes today's puzzle and adds it to the database and updates `today.json` on GitHub.
- **Example**: `/today/add/your-secret-key`

#### Add Puzzle by Date (Simple)
- **URL**: `GET /date/add/{apiKey}?date={date}`
- **Description**: Scrapes a puzzle for a specific date and adds it to the database.
- **Example**: `/date/add/your-secret-key?date=2024-01-19`

#### Add/Update Puzzle (Detailed)
- **URL**: `GET /api/add/{date}/{apiKey}`
- **Description**: Adds or updates a puzzle for a specific date.
- **Example**: `/api/add/2024-01-19/your-secret-key`

#### Update Latest Puzzle
- **URL**: `GET /api/update/latest/{apiKey}`
- **Description**: Checks for and adds the latest available puzzle.
- **Example**: `/api/update/latest/your-secret-key`

#### Delete PuzzleData
- **URL**: `GET /api/delete/{date}/{apiKey}`
- **Description**: Deletes puzzle data for a specific date from the database.
- **Example**: `/api/delete/2024-01-19/your-secret-key`

#### Trigger GitHub Commit
- **URL**: `GET /today/commit/{apiKey}`
- **Description**: Manually triggers an update of the `today.json` file on your configured GitHub repository.
- **Example**: `/today/commit/your-secret-key`

---

## Configuration

The API key is set via the `API_TOKEN` environment variable in Cloudflare.

```toml
[vars]
API_TOKEN = "your-secret-token-here"
```

## Deployment

1.  **Create D1 Database**: `npx wrangler d1 create crossword_archive`
2.  **Apply Schema**: `npx wrangler d1 execute crossword_archive --file=migrations/0000_initial_migration.sql`
3.  **Deploy**: `npm run deploy`

## License

MIT