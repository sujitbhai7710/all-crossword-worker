# All Crossword Worker

A distributed crossword puzzle archiving system built on Cloudflare Workers, D1 (SQLite), and KV. Each crossword source gets its own Cloudflare Worker with independent D1 database and KV cache, maximizing free tier quotas across separate accounts.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Cloudflare Edge                     │
│                                                       │
│  ┌──────────┐  ┌──────────┐       ┌──────────┐      │
│  │ Worker 1 │  │ Worker 2 │  ...  │ Worker N │      │
│  │ Atlantic │  │ Guardian │       │ Vox      │      │
│  └────┬─────┘  └────┬─────┘       └────┬─────┘      │
│       │              │                  │             │
│  ┌────▼─────┐  ┌────▼─────┐       ┌────▼─────┐      │
│  │ D1 + KV  │  │ D1 + KV  │       │ D1 + KV  │      │
│  └──────────┘  └──────────┘       └──────────┘      │
│                                                       │
│  Cron Triggers ──▶ Auto-fetch latest puzzles daily   │
└─────────────────────────────────────────────────────┘
```

### 3-Layer Cache Strategy

1. **KV Hot Cache** (first check) — Fast key-value lookups for frequent queries
2. **D1 Database** (second check) — Persistent SQLite storage for all puzzle data
3. **External Source** (cron only) — Fetch from crossword providers on schedule

### Code Generation

Worker projects are auto-generated from `config/workers.json`:

```bash
npm run generate
```

This reads `config/workers.json` and creates per-worker directories under `workers/` with `src/index.js` and `wrangler.toml`.

## Supported Sources (19 Workers)

| # | Source | Slug | Method | Schedule |
|---|--------|------|--------|----------|
| 1 | **Atlantic** | `atlantic` | AmuseLabs CDN | Daily |
| 2 | **Guardian Cryptic** | `guardian-cryptic` | Series page + gu-island | Mon-Fri |
| 3 | **Guardian Prize** | `guardian-prize` | Series page + gu-island | Saturday |
| 4 | **Guardian Quick** | `guardian-quick` | Series page + gu-island | Mon-Sat |
| 5 | **Guardian Quiptic** | `guardian-quiptic` | Series page + gu-island | Sunday |
| 6 | **Guardian Weekend** | `guardian-weekend` | Series page + gu-island | Saturday |
| 7 | **LA Times Daily** | `latimes-daily` | uclick XML | Daily |
| 8 | **LA Times Mini** | `latimes-mini` | AmuseLabs + loadToken | Daily |
| 9 | **USA Today Daily** | `usa-today-daily` | uclick XML | Daily |
| 10 | **WaPo Daily** | `washington-post-daily` | WaPo JSON API | Daily |
| 11 | **WaPo Mini** | `washington-post-mini` | WaPo JSON API | Mon-Sat |
| 12 | **WaPo Sunday** | `washington-post-sunday` | WaPo JSON API | Sunday |
| 13 | **New Yorker** | `new-yorker` | Conde Nast API + UUID | Daily |
| 14 | **New Yorker Mini** | `new-yorker-mini` | Conde Nast API + UUID | Daily |
| 15 | **Universal** | `universal` | AM Universal JSON API | Daily |
| 16 | **Newsday** | `newsday` | AmuseLabs + loadToken + fvlt | Daily |
| 17 | **Vox** | `vox` | AmuseLabs + loadToken + fvlt | Daily |
| 18 | **Daily Pop** | `daily-pop` | PuzzleNation API (XML) | Daily |
| 19 | **NYT Midi** | `nyt-midi` | NYT v6 API + auth bypass | Daily |

**Separate repos** (not generated):
- **NYT Daily** — `nyt-crossword/archive-worker/`
- **NYT Mini** — `nyt-crossword/crossword mini archive/`
- **Solver API** — `crossword backend solver/worker/`

### Removed (Dead Sources)

These sources have been verified as permanently unavailable and removed from `config/workers.json`:

| Source | Reason | Death Date |
|--------|--------|------------|
| Guardian Everyman | Discontinued, moved to Observer | April 2025 |
| Guardian Speedy | Discontinued, moved to Observer | April 2025 |
| USA Today Quick | All 8 API approaches return 403/404 | Unknown |

## API Endpoints

Every worker exposes the same REST API:

### Read Endpoints (Public)

```
GET /                                    # Service info + endpoint list
GET /api/puzzle/{date}                   # Full puzzle for a date (YYYY-MM-DD)
GET /api/puzzle/latest                   # Most recently stored puzzle
GET /api/clues/{date}                    # Clues only for a date
GET /api/search/answer?q={answer}        # Search clues by answer text
    ?mode=exact                          #   Exact match (default)
    ?mode=contains                       #   Substring match
GET /api/search/clue?q={text}            # Search by clue text
    ?mode=contains                       #   Substring match (default)
    ?mode=exact                          #   Exact match
GET /api/related/answer?q={answer}       # All clues from puzzles containing this answer
```

### Write Endpoints (Require API Token)

```
POST /api/add/{date}                     # Fetch and store puzzle for date
POST /api/update/latest                  # Fetch and store latest available puzzle
POST /api/delete/{date}                  # Delete puzzle and its clues
```

Authentication: Set `API_TOKEN` secret via `npx wrangler secret put API_TOKEN`, then pass as:
- `Authorization: Bearer <token>` header, OR
- Last URL path segment: `/api/add/2026-05-25/<token>`

**Security**: If `API_TOKEN` is not configured, all write endpoints return 401.

### Response Format

All responses follow this structure:

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-05-26T12:00:00.000Z"
}
```

Error responses:

```json
{
  "success": false,
  "error": "No puzzle found for date: 2026-05-25"
}
```

### Puzzle Data Structure

```json
{
  "puzzle": {
    "puzzle_id": 1,
    "date": "2026-05-25",
    "formatted_date": "May 25, 2026",
    "title": "Sunday Crossword",
    "author": "John Doe",
    "editor": "Jane Smith",
    "day_of_week": "Sunday"
  },
  "across": [
    { "clue_id": 1, "number": 1, "direction": "across", "clue_text": "Clue text", "answer": "ANSWER" }
  ],
  "down": [
    { "clue_id": 2, "number": 2, "direction": "down", "clue_text": "Clue text", "answer": "ANSWER" }
  ]
}
```

## Provider Methods

Each crossword source uses a different API/scraping method:

### AmuseLabs CDN (Atlantic, LA Times Mini, Newsday, Vox)

Atlantic works directly via CDN. LA Times Mini, Newsday, and Vox require a `loadToken` extracted from the date-picker page to avoid 302 redirects.

```
1. Fetch date-picker page → extract <script id="params"> JSON
2. Base64-decode rawsps → get loadToken (JWT)
3. Append &loadToken=... to solver URL → returns 200 with puzzle page
4. Parse rawc puzzle data from the page
```

Newsday and Vox also compute an `fvlt` verification token from the JWT's `uid` claim.

### uclick XML (LA Times Daily, USA Today Daily)

Simple XML feed from Andrews McMeel Universal (AMU):

```
GET http://picayune.uclick.com/comics/{slug}/data/{slug}{YYMMDD}-data.xml
```

### WaPo JSON API (WaPo Daily, Mini, Sunday)

Washington Post Games Service:

```
GET https://games-service-prod.site.aws.wapo.pub/crossword/levels/{type}/{Y}/{M}/{D}
```

Types: `daily`, `mini`, `sunday`. Supports T+1 day access (tomorrow's puzzle available today).

### Conde Nast API (New Yorker, New Yorker Mini)

Two-step process:

```
1. Fetch date page: https://www.newyorker.com/puzzles-and-games-dept/crossword/{Y}/{M}/{D}
2. Extract UUID: regex "id":"{uuid}"
3. Fetch puzzle: https://puzzles-games-api.gp-prod.conde.digital/api/v1/games/{uuid}
```

Returns xd format text with `## Metadata`, `## Grid`, `## Clues` sections.

### AM Universal JSON (Universal)

```
GET https://gamedata.services.amuniversal.com/c/uucom/l/{token}/g/fcx/d/{YYYY-MM-DD}/data.json
```

Returns JSON with `Title`, `AllAnswer`, `AcrossClue`, `DownClue` (pipe-delimited), `Solution` grid.

### PuzzleNation API (Daily Pop)

```
1. Fetch API key: http://dailypopcrosswordsweb.puzzlenation.com/crosswordSetup.js
2. Extract API_KEY from JS
3. Fetch puzzle: https://api.puzzlenation.com/dailyPopCrosswords/puzzles/daily/{YYMMDD}
   Header: x-api-key: {key}
```

Returns Crossword Compiler XML format with `<cell>` and `<word>` elements.

### Guardian Series Page (All Guardian variants)

```
1. Fetch series page: https://www.theguardian.com/crosswords/series/{tag}
2. Extract puzzle URLs from page HTML
3. Fetch puzzle page → extract <gu-island name="CrosswordComponent">
4. Decode props JSON (HTML entity decode) → parse puzzle data
```

Falls back to Guardian Content API for historical date lookups.

### NYT v6 API (NYT Daily, Mini, Midi)

```
GET https://www.nytimes.com/svc/crosswords/v6/puzzle/{type}/{date}.json
Header: x-games-auth-bypass: true
```

Types: `daily`, `mini`, `midi`. Returns JSON with cells array (including answers) and clues.

## Cron Schedules

Workers use Cloudflare Cron Triggers to automatically fetch new puzzles:

| Worker | Cron (UTC) | ET Time | Why |
|--------|-----------|---------|-----|
| NYT Daily | `0 3 * * 1-5` + `0 23 * * 0,6` | 10PM/6PM | Catches both publication times |
| NYT Mini | `1 3 * * *` + `1 23 * * 6` | 10:01PM/6:01PM | Same, offset 1 min |
| NYT Midi | `2 3 * * *` | 10:02PM | Daily |
| Guardian Quick | `0 0 * * 1-6` | Midnight GMT | Mon-Sat |
| Guardian Cryptic | `0 0 * * 1-5` | Midnight GMT | Mon-Fri |
| Guardian Prize | `0 0 * * 6` | Midnight GMT | Saturday |
| Guardian Quiptic | `0 0 * * 0` | Midnight GMT | Sunday |
| Guardian Weekend | `0 0 * * 6` | Midnight GMT | Saturday |
| Atlantic | `0 5 * * *` | Midnight ET | Daily |
| LA Times Daily | `0 5 * * *` | Midnight ET | Daily |
| LA Times Mini | `5 5 * * *` | 12:05AM ET | Daily (offset) |
| USA Today Daily | `10 5 * * *` | 12:10AM ET | Daily |
| WaPo Daily | `15 5 * * *` | 12:15AM ET | Daily |
| WaPo Mini | `15 5 * * 1-6` | 12:15AM ET | Mon-Sat |
| WaPo Sunday | `15 5 * * 0` | 12:15AM ET | Sunday |
| New Yorker | `20 5 * * *` | 12:20AM ET | Daily |
| New Yorker Mini | `20 5 * * *` | 12:20AM ET | Daily |
| Newsday | `25 5 * * *` | 12:25AM ET | Daily |
| Universal | `30 5 * * *` | 12:30AM ET | Daily |
| Vox | `35 5 * * *` | 12:35AM ET | Daily |
| Daily Pop | `40 5 * * *` | 12:40AM ET | Daily |

**Catch-up cron** (add to ALL workers): `0 14 * * *` — UTC 14:00 catches anything missed.

## Setup

### Prerequisites

- Node.js 18+
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account (free tier works)

### Deploy a Worker

```bash
# 1. Generate workers from config
cd all-crossword-worker
npm install
npm run generate

# 2. Set up a specific worker
cd workers/atlantic

# 3. Create D1 database
npx wrangler d1 create atlantic_crossword_archive
# Copy the database_id from output into wrangler.toml

# 4. Create KV namespace
npx wrangler kv namespace create HOT_CACHE
# Copy the id into wrangler.toml as HOT_CACHE.id
npx wrangler kv namespace create HOT_CACHE --preview
# Copy the id into wrangler.toml as HOT_CACHE.preview_id

# 5. Set API token (optional but recommended)
npx wrangler secret put API_TOKEN

# 6. Run migrations
npx wrangler d1 execute atlantic_crossword_archive \
  --file=../../shared/migrations/0000_initial_migration.sql --remote
npx wrangler d1 execute atlantic_crossword_archive \
  --file=../../shared/migrations/0001_normalized_lookup_columns.sql --remote

# 7. Deploy
npx wrangler deploy
```

See `SETUP-COMMANDS.md` for step-by-step commands for every worker.

### Local Development

```bash
cd workers/atlantic
npx wrangler dev
# Test at http://localhost:8787
```

## Database Schema

### puzzles table

| Column | Type | Description |
|--------|------|-------------|
| puzzle_id | INTEGER PRIMARY KEY | Auto-increment ID |
| date | TEXT UNIQUE | YYYY-MM-DD |
| formatted_date | TEXT | "May 25, 2026" |
| title | TEXT | Puzzle title |
| author | TEXT | Constructor name |
| editor | TEXT | Editor name |
| day_of_week | TEXT | "Monday"-"Sunday" |
| permalink | TEXT | Source URL |
| created_at | TEXT | ISO timestamp |

### clues table

| Column | Type | Description |
|--------|------|-------------|
| clue_id | INTEGER PRIMARY KEY | Auto-increment ID |
| puzzle_id | INTEGER | FK → puzzles |
| number | INTEGER | Clue number |
| direction | TEXT | "across" or "down" |
| clue_text | TEXT | Original clue text |
| answer | TEXT | Answer text |
| clue_norm | TEXT | Normalized clue for search |
| answer_norm | TEXT | Normalized answer for search |
| answer_len | INTEGER | Answer character count |

### Indexes (from migration 0001)

```sql
CREATE INDEX idx_clues_clue_norm ON clues(clue_norm);
CREATE INDEX idx_clues_answer_norm ON clues(answer_norm);
CREATE INDEX idx_clues_answer_len ON clues(answer_len);
CREATE INDEX idx_clues_puzzle_id ON clues(puzzle_id);
CREATE INDEX idx_puzzles_date ON puzzles(date);
```

## Project Structure

```
all-crossword-worker/
├── config/
│   └── workers.json              # Worker definitions (drives code generation)
├── scripts/
│   └── generate.mjs              # Code generator (workers.json → workers/*)
├── shared/
│   ├── core/
│   │   ├── createArchiveWorker.js # Main API framework + D1 + KV + cron
│   │   ├── utils.js              # Shared utilities (normalize, parse, fetch)
│   │   └── amuselabs.js          # AmuseLabs deobfuscation (rawc parsing)
│   ├── providers/
│   │   ├── atlantic.js           # Atlantic (AmuseLabs direct)
│   │   ├── guardian.js           # Guardian (series page + Content API fallback)
│   │   ├── latimes.js            # LA Times Daily (uclick XML) + Mini (AmuseLabs + loadToken)
│   │   ├── usaToday.js           # USA Today Daily (uclick XML)
│   │   ├── washingtonPost.js     # WaPo (JSON API, 3 types)
│   │   ├── newYorker.js          # New Yorker + Mini (Conde Nast API)
│   │   ├── universal.js          # Universal (AM Universal JSON)
│   │   ├── newsday.js            # Newsday (AmuseLabs + loadToken + fvlt)
│   │   ├── vox.js                # Vox (AmuseLabs + loadToken + fvlt)
│   │   ├── dailyPop.js           # Daily Pop (PuzzleNation API + XML parser)
│   │   └── nyt.js                # NYT Midi (v6 API + auth bypass)
│   └── migrations/
│       ├── 0000_initial_migration.sql
│       └── 0001_normalized_lookup_columns.sql
├── workers/                       # Auto-generated per-worker directories
│   ├── atlantic/
│   │   ├── src/index.js
│   │   └── wrangler.toml
│   ├── daily-pop/
│   ├── guardian-cryptic/
│   ├── ...
│   └── vox/
├── nyt-crossword/                 # Separate NYT workers (not generated)
│   ├── archive-worker/            # NYT Daily
│   └── crossword mini archive/    # NYT Mini
├── crossword backend solver/      # Crossword solver API
├── test-worker/                   # Test worker (see below)
├── crossword-system-master-plan.md # Complete documentation of all fixes
├── README.md                      # This file
├── SETUP-COMMANDS.md              # Step-by-step deploy commands
└── package.json
```

## Test Worker

A dedicated Cloudflare Worker for testing crossword source APIs directly from the edge. This was used to verify which sources work from Cloudflare Workers and which approaches succeed.

### Deployed URL

```
https://crossword-test-worker.slideshow.workers.dev
```

### Test Endpoints

```
GET /                              # List all test endpoints
GET /test/latimes-mini?date=...    # Test LA Times Mini (loadToken approach)
GET /test/usa-today-quick?date=... # Test USA Today Quick (all 8 approaches)
GET /test/new-yorker?date=...      # Test New Yorker (Conde Nast API)
GET /test/guardian-quick?date=...  # Test Guardian Quick
GET /test/guardian-cryptic?date=...# Test Guardian Cryptic
GET /test/guardian-prize?date=...  # Test Guardian Prize
GET /test/guardian-quiptic?date=...# Test Guardian Quiptic
GET /test/guardian-weekend?date=...# Test Guardian Weekend
GET /test/newsday?date=...         # Test Newsday (AmuseLabs)
GET /test/universal?date=...       # Test Universal (AM Universal)
GET /test/puzzmo?date=...          # Test Puzzmo (GraphQL)
GET /test/vox?date=...             # Test Vox (AmuseLabs)
GET /test/daily-pop?date=...       # Test Daily Pop (PuzzleNation)
GET /test/atlantic?date=...        # Test Atlantic (AmuseLabs)
GET /test/nyt?date=...             # Test NYT (all types + oracle)
GET /test/wapo?date=...            # Test WaPo (all 3 types + future)
GET /test/all?date=...             # Run ALL tests in parallel
```

### Purpose

- **Source verification**: Confirms which crossword APIs are accessible from Cloudflare Workers
- **Approach testing**: Tries multiple API approaches for each source (e.g., 8 approaches for USA Today Quick)
- **Bug reproduction**: Reproduces issues like LA Times Mini's 302 redirect and verifies fixes
- **New source exploration**: Tests new providers before building full workers
- **No database**: Pure testing — no D1 or KV dependencies

### Key Discoveries From Testing

1. **New Yorker WORKS**: Conde Nast API returns 200 with full puzzle data when using UUID from date page. Previous belief that it was "WAF blocked" was wrong — we were hitting the wrong endpoint (list endpoint without UUID).

2. **LA Times Mini loadToken**: AmuseLabs returns 302 without loadToken, but 200 with it. Token is extracted from date-picker page's `<script id="params">` → base64-decode `rawsps` → get `loadToken`.

3. **USA Today Quick is DEAD**: All 8 approaches tested from Cloudflare Workers return 403/404. This source is permanently unavailable.

4. **Guardian Everyman/Speedy DEAD**: Last puzzle was April 20, 2025. Now discontinued and moved to Observer.

5. **WaPo T+1**: Washington Post API returns tomorrow's puzzle today with full answers.

6. **Universal, Daily Pop, Newsday, Vox, NYT Midi**: All verified working from CF Workers.

## Production Endpoints

| Worker | URL |
|--------|-----|
| NYT Daily Archive | `https://crossword-archive-worker.mitomat.workers.dev` |
| NYT Mini Archive | `https://nyt-mini-archive.nytsolver.workers.dev` |
| Solver API | `https://crossword-solver-api.mitomat.workers.dev` |
| Test Worker | `https://crossword-test-worker.slideshow.workers.dev` |

## Cloudflare Free Tier Optimization

Each worker in its own account gets independent quotas:

| Resource | Per Account | With 20+ Accounts |
|----------|-----------|-------------------|
| Worker Requests | 100K/day | 2M+/day |
| D1 Reads | 5M/day | 100M+/day |
| D1 Writes | 100K/day | 2M+/day |
| KV Reads | 100K/day | 2M+/day |
| Cache API | **UNLIMITED** | **UNLIMITED** |

The Cache API has no limits on the free tier — this is the most important optimization. KV is used as the hot cache layer (fast, 100K reads/day) while D1 provides persistent storage.

## Key Bug Fixes Applied

| Bug | Fix | Status |
|-----|-----|--------|
| `/api/puzzle/latest` returns 400 | Added explicit route before date-based route | ✅ Fixed |
| N+1 query in `getRelatedClues()` | Single JOIN query with LIMIT 2500 | ✅ Fixed |
| Write endpoints use GET (CSRF) | Method check added | ✅ Fixed |
| No API_TOKEN = open access | Deny all writes when token not configured | ✅ Fixed |
| NYT Mini unknown routes return 200 | Changed fallback to 404 | ✅ Fixed |
| NYT Mini searchByClue wrong column | Changed to `clue_norm` instead of `LOWER(clue)` | ✅ Fixed |
| NYT Archive searchByClueText wrong column | Changed to `c.clue_norm` | ✅ Fixed |
| Guardian Weekend wrong URL pattern | Added SERIES_URL_OVERRIDES mapping | ✅ Fixed |
| LA Times Mini 302 redirect | Added loadToken from date-picker | ✅ Fixed |
| New Yorker WAF block | Switched to Conde Nast API with UUID | ✅ Fixed |
| Non-atomic puzzle saves | Use `env.DB.batch()` for bulk inserts | ✅ Fixed |

## References

- **xword-dl** (Python reference): https://github.com/thisisparker/xword-dl
- **Cloudflare Workers docs**: https://developers.cloudflare.com/workers/
- **Cloudflare D1 docs**: https://developers.cloudflare.com/d1/
- **Frontend repo**: https://github.com/0xSatwik/crosasword-solver-and-answer

## License

MIT
