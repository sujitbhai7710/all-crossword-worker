# Test Worker — Crossword Source API Tester

This is a standalone Cloudflare Worker for testing crossword source APIs directly from the Cloudflare edge. No D1 database, no KV — pure testing.

## Why This Exists

Before building a full archive worker, you need to verify that a crossword source's API is accessible from Cloudflare Workers. This worker tests multiple approaches for each source and shows exactly what works and what doesn't.

## Deployed URL

```
https://crossword-test-worker.slideshow.workers.dev
```

## Endpoints

| Endpoint | What It Tests |
|----------|--------------|
| `/` | List all test endpoints |
| `/test/latimes-mini?date=2026-05-25` | LA Times Mini — direct CDN, date-picker loadToken, embed mode |
| `/test/usa-today-quick?date=2026-05-25` | USA Today Quick — GraphQL, uclick XML, AmuseLabs (8 approaches) |
| `/test/new-yorker?date=2026-05-25` | New Yorker — landing page, date page UUID, Conde Nast API, Puzzmo |
| `/test/guardian-quick?date=2026-05-25` | Guardian Quick — Content API, series page, gu-island extraction |
| `/test/guardian-cryptic?date=...` | Guardian Cryptic |
| `/test/guardian-prize?date=...` | Guardian Prize |
| `/test/guardian-quiptic?date=...` | Guardian Quiptic |
| `/test/guardian-weekend?date=...` | Guardian Weekend |
| `/test/newsday?date=2026-05-25` | Newsday — AmuseLabs picker, direct CDN, rawc check |
| `/test/universal?date=2026-05-25` | Universal — AM Universal JSON API |
| `/test/puzzmo?date=2026-05-25` | Puzzmo — GraphQL queries |
| `/test/vox?date=2026-05-25` | Vox — AmuseLabs picker, CDN, rawc check |
| `/test/daily-pop?date=2026-05-25` | Daily Pop — JS API key extraction, PuzzleNation API |
| `/test/atlantic?date=2026-05-25` | Atlantic — AmuseLabs CDN (verify working) |
| `/test/nyt?date=2026-05-25` | NYT — all types (daily/mini/midi/bonus), oracle, future dates |
| `/test/wapo?date=2026-05-25` | WaPo — daily/mini/sunday, future date access |
| `/test/all?date=2026-05-25` | Run ALL tests in parallel |

## How It Works

Each test function:
1. Tries multiple API approaches for that source
2. Returns raw HTTP status, headers, and response body preview
3. Shows which approach works and which fails
4. No side effects — no database writes

### Example: Testing New Yorker

```
GET /test/new-yorker?date=2026-05-25
```

Returns:
```json
{
  "a1_landing": { "status": 200, "bodyLen": 95000 },
  "a2_date_page": { "status": 200 },
  "a4b_uuid_from_date": "9bfa0660-ea23-4002-b51e-f5675888a8bd",
  "a4b_conde_response": {
    "status": 200,
    "bodyLen": 45000
  }
}
```

This tells you: the date page returns 200, you can extract a UUID, and the Conde Nast API with that UUID returns 200 with full puzzle data. Build the worker!

### Example: Testing USA Today Quick

```
GET /test/usa-today-quick?date=2026-05-25
```

Returns:
```json
{
  "a1_graphql_get": { "status": 403 },
  "a2_graphql_post": { "status": 403 },
  "a3_landing": { "status": 403 },
  "a5_uclick_xml": { "status": 404 },
  "a4_amuselabs_sets": {
    "usatodayquickcross": { "status": 200, "len": 0 },
    "quickcross": { "status": 200, "len": 0 }
  }
}
```

All approaches fail — this source is DEAD. Don't build a worker for it.

## How to Add a New Source Test

1. Add a test function in `src/index.js`:

```javascript
async function testMyNewSource(date) {
  const results = {};

  // Test approach 1: Direct API
  results.a1_direct = await fetchWithHeaders(
    'https://example.com/api/puzzle/' + date
  );

  // Test approach 2: With auth headers
  results.a2_with_auth = await fetchWithHeaders(
    'https://example.com/api/puzzle/' + date,
    { 'Authorization': 'Bearer ...' }
  );

  return results;
}
```

2. Add a route in the switch statement:

```javascript
case '/test/my-new-source': results = await testMyNewSource(date); break;
```

3. Redeploy: `npx wrangler deploy`

## Deploy

```bash
cd test-worker
npx wrangler deploy
```

## Source Code

See `src/index.js` — it's a single file, no dependencies, ~600 lines.

## Key Discoveries Made With This Worker

| Source | Previous Belief | Actual Finding |
|--------|----------------|---------------|
| New Yorker | "403 WAF blocked" | Works with UUID from date page via Conde Nast API |
| LA Times Mini | "302 redirect, broken" | Works with loadToken from date-picker page |
| USA Today Quick | "Broken, needs fix" | Permanently dead — all 8 approaches fail |
| Guardian Everyman | "Maybe fixable" | Dead since April 2025 — no puzzles exist |
| Universal | "Not tested from CF" | Works perfectly — AM Universal JSON API |
| Daily Pop | "Not tested from CF" | Works — PuzzleNation API with extracted key |
