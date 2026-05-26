# Crossword Archiving System — Cloudflare Workers

A distributed crossword puzzle archiving system. Each source gets its own Cloudflare Worker with D1 (SQLite) + KV cache. Workers auto-fetch new puzzles via cron triggers.

## Quick Links

| What | Where |
|------|-------|
| **Master Plan** (all fixes, dead sources, new providers, bugs) | [`docs/master-plan.md`](docs/master-plan.md) |
| **Test Worker** (API testing from CF edge) | [`test-worker/`](test-worker/) |
| **Shared Framework** (API server, D1, KV, cron) | [`shared/core/`](shared/core/) |
| **Provider Fetchers** (one per source) | [`shared/providers/`](shared/providers/) |
| **Worker Config** (drives code generation) | [`config/workers.json`](config/workers.json) |
| **Generated Workers** (19 ready-to-deploy) | [`workers/`](workers/) |
| **Database Migrations** | [`shared/migrations/`](shared/migrations/) |
| **Deploy Commands** (step-by-step per worker) | [`SETUP-COMMANDS.md`](SETUP-COMMANDS.md) |

## 19 Workers

| # | Source | Slug | Provider Method | Provider File |
|---|--------|------|----------------|---------------|
| 1 | Atlantic | `atlantic` | AmuseLabs CDN direct | `atlantic.js` |
| 2 | Guardian Cryptic | `guardian-cryptic` | Series page + gu-island | `guardian.js` |
| 3 | Guardian Prize | `guardian-prize` | Series page + gu-island | `guardian.js` |
| 4 | Guardian Quick | `guardian-quick` | Series page + gu-island | `guardian.js` |
| 5 | Guardian Quiptic | `guardian-quiptic` | Series page + gu-island | `guardian.js` |
| 6 | Guardian Weekend | `guardian-weekend` | Series page + gu-island | `guardian.js` |
| 7 | LA Times Daily | `latimes-daily` | uclick XML | `latimes.js` |
| 8 | LA Times Mini | `latimes-mini` | AmuseLabs + loadToken | `latimes.js` |
| 9 | USA Today Daily | `usa-today-daily` | uclick XML | `usaToday.js` |
| 10 | WaPo Daily | `washington-post-daily` | WaPo JSON API | `washingtonPost.js` |
| 11 | WaPo Mini | `washington-post-mini` | WaPo JSON API | `washingtonPost.js` |
| 12 | WaPo Sunday | `washington-post-sunday` | WaPo JSON API | `washingtonPost.js` |
| 13 | New Yorker | `new-yorker` | Conde Nast API + UUID | `newYorker.js` |
| 14 | New Yorker Mini | `new-yorker-mini` | Conde Nast API + UUID | `newYorker.js` |
| 15 | Universal | `universal` | AM Universal JSON | `universal.js` |
| 16 | Newsday | `newsday` | AmuseLabs + loadToken + fvlt | `newsday.js` |
| 17 | Vox | `vox` | AmuseLabs + loadToken + fvlt | `vox.js` |
| 18 | Daily Pop | `daily-pop` | PuzzleNation XML API | `dailyPop.js` |
| 19 | NYT Midi | `nyt-midi` | NYT v6 API + auth bypass | `nyt.js` |

### Dead Sources (Removed — Do NOT Rebuild)

| Source | Why Dead |
|--------|----------|
| Guardian Everyman | Discontinued April 2025 |
| Guardian Speedy | Discontinued April 2025 |
| USA Today Quick | All 8 API approaches fail (403/404) |

## How It Works

### Architecture

```
config/workers.json
       │
       ▼
scripts/generate.mjs  ──▶  workers/{slug}/src/index.js
                           workers/{slug}/wrangler.toml
```

Each generated worker imports from `shared/`:
- `shared/core/createArchiveWorker.js` — REST API server with D1 + KV
- `shared/providers/{source}.js` — Source-specific fetcher
- `shared/migrations/` — D1 schema

### 3-Layer Cache

```
Request → KV Hot Cache → D1 Database → 404
              (fast)        (slow)
```

KV caches frequent queries (1h TTL). D1 stores all puzzle data permanently.

### Code Generation

```bash
npm run generate    # Reads config/workers.json, creates workers/*/
```

### Every Worker Has the Same API

#### Read (Public)

```
GET /                                    # Info + endpoint list
GET /api/puzzle/2026-05-25              # Full puzzle for a date
GET /api/puzzle/latest                  # Most recently stored puzzle
GET /api/clues/2026-05-25              # Clues only for a date
GET /api/search/answer?q=BEAR          # Search by answer (exact/contains)
GET /api/search/clue?q=brown+bear      # Search by clue text
GET /api/related/answer?q=BEAR         # All clues from puzzles with this answer
```

#### Write (Requires API_TOKEN secret)

```
POST /api/add/2026-05-25               # Fetch + store puzzle for date
POST /api/update/latest                # Fetch + store latest available
POST /api/delete/2026-05-25            # Delete puzzle + its clues
```

Auth: `Authorization: Bearer <token>` header or last URL path segment.

### Example Worker Code (Atlantic)

```javascript
// workers/atlantic/src/index.js (auto-generated)
import { createArchiveWorker } from '../../shared/core/createArchiveWorker.js';
import { createAtlanticProvider } from '../../shared/providers/atlantic.js';

export default createArchiveWorker(createAtlanticProvider());
```

That's it. The provider defines `fetchByDate()`, the framework handles everything else.

## How to Add a New Source

### 1. Create a Provider File

Create `shared/providers/mySource.js`:

```javascript
import { fetchText, fetchJson, notFound, normalizePuzzlePayload,
         getDayOfWeek, getFormattedDate } from '../core/utils.js';

export function createMySourceProvider() {
  return {
    slug: 'my-source',           // matches workers.json slug
    title: 'My Source Crossword',
    lookbackDays: 14,            // how many days back cron tries

    async fetchByDate(date, env) {
      // Fetch from the source API
      const url = `https://api.example.com/puzzle/${date}`;
      const json = await fetchJson(url, {
        headers: { 'Authorization': 'Bearer ...' }
      });

      if (!json.puzzle) throw notFound(`No puzzle for ${date}`);

      // Return normalized format
      return normalizePuzzlePayload({
        date,
        formatted_date: getFormattedDate(date),
        title: json.puzzle.title || '',
        author: json.puzzle.author || '',
        editor: json.puzzle.editor || '',
        day_of_week: getDayOfWeek(date),
        permalink: url,
        clues: [
          // Each clue: { number, direction, clue_text, answer }
          { number: 1, direction: 'across', clue_text: 'Clue text', answer: 'ANSWER' },
          { number: 2, direction: 'down', clue_text: 'Clue text', answer: 'ANSWER' },
        ]
      });
    }
  };
}
```

### 2. Add to workers.json

```json
{
  "slug": "my-source",
  "name": "My Source",
  "family": "my-source",
  "title": "My Source Crossword",
  "workerName": "my-source-worker",
  "databaseName": "my_source_archive"
}
```

### 3. Generate + Deploy

```bash
npm run generate
cd workers/my-source
npx wrangler d1 create my_source_archive
npx wrangler kv namespace create HOT_CACHE
npx wrangler secret put API_TOKEN
npx wrangler d1 execute my_source_archive --file=../../shared/migrations/0000_initial_migration.sql --remote
npx wrangler d1 execute my_source_archive --file=../../shared/migrations/0001_normalized_lookup_columns.sql --remote
npx wrangler deploy
```

## Provider Methods Explained

### AmuseLabs CDN (Atlantic, LA Times Mini, Newsday, Vox)

```
1. Fetch date-picker: https://cdn3.amuselabs.com/{set}/date-picker?set={set}
2. Extract <script id="params"> → JSON → rawsps → base64 decode → loadToken
3. Fetch puzzle: https://cdn3.amuselabs.com/{set}/crossword?id={id}&set={set}&loadToken={token}
4. Parse rawc puzzle data from page HTML
```

- Atlantic: Works directly (no loadToken needed)
- LA Times Mini: Needs loadToken (302 redirect without it)
- Newsday: Needs loadToken + fvlt verification
- Vox: Needs loadToken + fvlt verification

### uclick XML (LA Times Daily, USA Today Daily)

```
GET http://picayune.uclick.com/comics/{slug}/data/{slug}{YYMMDD}-data.xml
```

### WaPo JSON API (WaPo Daily, Mini, Sunday)

```
GET https://games-service-prod.site.aws.wapo.pub/crossword/levels/{type}/{Y}/{M}/{D}
```

Types: `daily`, `mini`, `sunday`. Supports T+1 day (tomorrow available today).

### Conde Nast API (New Yorker, New Yorker Mini)

```
1. Fetch date page: https://www.newyorker.com/puzzles-and-games-dept/crossword/{Y}/{M}/{D}
2. Extract UUID: regex "id":"{uuid}"
3. Fetch puzzle: https://puzzles-games-api.gp-prod.conde.digital/api/v1/games/{uuid}
```

Returns xd format (## Metadata / ## Grid / ## Clues sections).

### AM Universal JSON (Universal)

```
GET https://gamedata.services.amuniversal.com/c/uucom/l/{token}/g/fcx/d/{date}/data.json
```

Returns Title, AllAnswer, AcrossClue/DownClue (pipe-delimited), Solution grid.

### PuzzleNation API (Daily Pop)

```
1. Get API key: http://dailypopcrosswordsweb.puzzlenation.com/crosswordSetup.js
2. Fetch puzzle: https://api.puzzlenation.com/dailyPopCrosswords/puzzles/daily/{YYMMDD}
   Header: x-api-key: {key}
```

Returns Crossword Compiler XML format.

### Guardian Series Page (All Guardian variants)

```
1. Fetch series page: https://www.theguardian.com/crosswords/series/{tag}
2. Extract puzzle URLs from HTML
3. Fetch puzzle page → extract <gu-island name="CrosswordComponent">
4. Decode HTML entities in props → parse JSON → get puzzle data
```

Falls back to Content API for historical dates.

### NYT v6 API (NYT Midi)

```
GET https://www.nytimes.com/svc/crosswords/v6/puzzle/midi/{date}.json
Header: x-games-auth-bypass: true
```

## Database Schema

### puzzles

| Column | Type | Notes |
|--------|------|-------|
| puzzle_id | INTEGER PK | Auto-increment |
| date | TEXT UNIQUE | YYYY-MM-DD |
| formatted_date | TEXT | "May 25, 2026" |
| title | TEXT | Puzzle title |
| author | TEXT | Constructor |
| editor | TEXT | Editor |
| day_of_week | TEXT | Monday-Sunday |
| permalink | TEXT | Source URL |
| created_at | TEXT | ISO timestamp |

### clues

| Column | Type | Notes |
|--------|------|-------|
| clue_id | INTEGER PK | Auto-increment |
| puzzle_id | INTEGER | FK → puzzles |
| number | INTEGER | Clue number |
| direction | TEXT | across/down |
| clue_text | TEXT | Original text |
| answer | TEXT | Answer text |
| clue_norm | TEXT | Normalized for search |
| answer_norm | TEXT | Normalized for search |
| answer_len | INTEGER | Character count |

## Folder Structure

```
├── README.md                          # This file
├── SETUP-COMMANDS.md                  # Deploy commands per worker
├── package.json                       # npm run generate
│
├── config/
│   └── workers.json                   # Worker definitions → drives code generation
│
├── scripts/
│   └── generate.mjs                   # workers.json → workers/{slug}/
│
├── shared/
│   ├── core/
│   │   ├── createArchiveWorker.js     # REST API + D1 + KV + cron handler
│   │   ├── utils.js                   # fetch, normalize, parse, search helpers
│   │   └── amuselabs.js               # AmuseLabs rawc deobfuscation
│   ├── providers/
│   │   ├── atlantic.js                # Atlantic (AmuseLabs direct)
│   │   ├── guardian.js                # All Guardian variants (series page)
│   │   ├── latimes.js                 # LA Times Daily (uclick) + Mini (AmuseLabs)
│   │   ├── usaToday.js                # USA Today Daily (uclick XML)
│   │   ├── washingtonPost.js          # WaPo (JSON API, 3 types)
│   │   ├── newYorker.js               # New Yorker + Mini (Conde Nast API + xd parser)
│   │   ├── universal.js               # Universal (AM Universal JSON + Solution parser)
│   │   ├── newsday.js                 # Newsday (AmuseLabs + loadToken + fvlt)
│   │   ├── vox.js                     # Vox (AmuseLabs + loadToken + fvlt)
│   │   ├── dailyPop.js                # Daily Pop (PuzzleNation + CC XML parser)
│   │   └── nyt.js                     # NYT Midi (v6 API + auth bypass)
│   └── migrations/
│       ├── 0000_initial_migration.sql # puzzles + clues tables
│       └── 0001_normalized_lookup_columns.sql  # indexes + norm columns
│
├── workers/                           # Auto-generated (npm run generate)
│   ├── atlantic/
│   │   ├── src/index.js               # 3 lines: import + createArchiveWorker
│   │   └── wrangler.toml              # D1 + KV + cron config
│   ├── daily-pop/
│   ├── guardian-cryptic/
│   ├── guardian-prize/
│   ├── guardian-quick/
│   ├── guardian-quiptic/
│   ├── guardian-weekend/
│   ├── latimes-daily/
│   ├── latimes-mini/
│   ├── new-yorker/
│   ├── new-yorker-mini/
│   ├── newsday/
│   ├── nyt-midi/
│   ├── universal/
│   ├── usa-today-daily/
│   ├── vox/
│   ├── washington-post-daily/
│   ├── washington-post-mini/
│   └── washington-post-sunday/
│
├── test-worker/                       # Source API tester (no DB)
│   ├── src/index.js                   # 600 lines testing all sources
│   ├── wrangler.toml
│   └── README.md                      # Test endpoint docs
│
└── docs/
    └── master-plan.md                 # Complete fix plan, bugs, dead sources, everything
```

## Production Endpoints

| Worker | URL |
|--------|-----|
| Test Worker | `https://crossword-test-worker.slideshow.workers.dev` |
| NYT Daily Archive | `https://crossword-archive-worker.mitomat.workers.dev` |
| NYT Mini Archive | `https://nyt-mini-archive.nytsolver.workers.dev` |
| Solver API | `https://crossword-solver-api.mitomat.workers.dev` |

## Reference

- **xword-dl** (Python reference): https://github.com/thisisparker/xword-dl
- **Frontend**: https://github.com/0xSatwik/crosasword-solver-and-answer
