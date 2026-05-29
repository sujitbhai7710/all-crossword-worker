# Crossword Archiving System - Plan V2

**Last Reviewed**: 2026-05-28  
**Status**: Reviewed against the current repo, current deployed endpoints, live provider fetches, and current Cloudflare free-tier docs.

## Scope Reviewed

- `plan/all-crossword-worker/docs/master-plan.md`
- `plan/all-crossword-worker/`
- root `workers/` and root `shared/`
- `crossword backend solver/worker/`
- `nyt-crossword/archive-worker/`
- `nyt-crossword/crossword mini archive/`

## Review Method

1. Read the current plan and both code trees: `plan/...` and the root runtime.
2. Ran live provider smoke tests on representative sources.
3. Checked deployed endpoints for behavior and response headers.
4. Re-checked Cloudflare free-tier limits from official docs because the scaling section depends on those numbers.

## Legend

Change notes use this format:

`[master-plan: old direction -> changed: new direction]`

---

## Quick Reference

### Repo Status

Current finding:
The checked-in `plan/all-crossword-worker/` tree is still mainly a framework, docs, shared code, and a test worker. The root `workers/` tree is still the older 15-worker set.

Action:
Use one canonical runtime and retire the duplicate tree.

Change note:
`[master-plan: changes already applied -> changed: codebase is still split and drifting]`

### USA Today Quick

Current finding:
The plan says this source is dead and should be removed. Live fetches succeeded for `2026-05-21` through `2026-05-28` using the current root provider.

Action:
Keep it and move it to a "monitored working" state instead of deleting it.

Change note:
`[master-plan: remove provider -> changed: keep provider and add canary test]`

### Guardian Recent Puzzles

Current finding:
The root provider still fails recent dates. The planned series-page fallback improves freshness, but it returns the latest puzzle even when an older requested date is passed.

Action:
Keep the series-page approach, but validate the requested date before returning any puzzle.

Change note:
`[master-plan: fix complete -> changed: fix is incomplete and date-unsafe]`

### LA Times Mini

Current finding:
The root provider still fails with `AmuseLabs page did not contain a rawc payload.` The planned provider works in live tests.

Action:
Port the planned fix into the canonical runtime.

Change note:
`[master-plan: fixed in repo -> changed: fixed only in the planned copy]`

### Read Caching

Current finding:
Current runtimes rely mainly on KV hot-cache. Public archive endpoints do not currently send strong cache headers. The plan talks about Cache API as the main optimization, but it is not fully implemented.

Action:
Add `Cache-Control` and `ETag`, then use Cache API as edge-local cache. Do not rely on Cache API alone for the whole global read path.

Change note:
`[master-plan: Cache API first already implied -> changed: not implemented yet, and must be paired with static assets or KV/R2]`

### Cron Design

Current finding:
The generator still hardcodes the same three cron expressions for every worker.

Action:
Replace per-worker crons with one scheduler worker.

Change note:
`[master-plan: per-provider schedule -> changed: centralized scheduler with <= 5 account-level cron triggers]`

### Scale Strategy

Current finding:
The multi-account approach is operationally expensive and should not be the first optimization step.

Action:
First optimize the read path with static assets and cache. Only shard across accounts if measured limits require it later.

Change note:
`[master-plan: multi-account by default -> changed: single-account-first architecture]`

### Solver Mini Lookup

Current finding:
Local config enables mini lookup, but the deployed solver did not include mini history for a clue that the mini archive returned as an exact match.

Action:
Treat this as deployment or config drift and add an integration test for it.

Change note:
`[master-plan: mini lookup is part of the solver path -> changed: verify and enforce in deployment]`

### Analytics Priority

Current finding:
Analytics is useful, but it is not the first bottleneck for free-tier traffic.

Action:
Move analytics after runtime unification, cache fixes, and static read-plane rollout.

Change note:
`[master-plan: analytics next -> changed: defer until core scale path is stable]`

---

## Part 1: Provider Status After Live Tests

### Atlantic

Dates tested:
`2026-05-25`

Result:
Pass using the root provider.

Action:
Keep as working.

### Guardian Quick - Root Provider

Dates tested:
`2026-05-25` to `2026-05-28`

Result:
Fail. Recent dates were not found.

Action:
Replace the root Guardian logic.

### Guardian Quick - Planned Provider

Dates tested:
`2026-05-25` to `2026-05-28`

Result:
Partial. It returned a puzzle, but it returned the same latest puzzle for every tested date.

Action:
Fix exact-date validation before rollout.

### LA Times Mini - Root Provider

Dates tested:
`2026-05-25` to `2026-05-28`

Result:
Fail. No `rawc` payload found.

Action:
Do not deploy the root version.

### LA Times Mini - Planned Provider

Dates tested:
`2026-05-25` to `2026-05-28`

Result:
Pass.

Action:
Use this implementation as the base.

### USA Today Quick - Root Provider

Dates tested:
`2026-05-21` to `2026-05-28`

Result:
Pass.

Action:
Keep and monitor.

### New Yorker - Planned Provider

Dates tested:
`2026-05-25`

Result:
Pass.

Action:
Build and deploy.

### Universal - Planned Provider

Dates tested:
`2026-05-25`

Result:
Pass.

Action:
Build and deploy.

### Vox - Planned Provider

Dates tested:
`2026-05-25`

Result:
Pass.

Action:
Build and deploy.

### Newsday - Planned Provider

Dates tested:
`2026-05-25`

Result:
Pass.

Action:
Build and deploy.

### NYT Midi - Planned Provider

Dates tested:
`2026-05-25`

Result:
Pass.

Action:
Build and deploy.

### Revised Provider Decisions

#### Keep `usa-today-quick`

Reason:
It is working now and should not be removed based on the current evidence.

Change note:
`[master-plan: DEAD/remove -> changed: WORKING as of 2026-05-28, keep with monitoring]`

#### Keep planned `new-yorker`, `universal`, `newsday`, `vox`, and `nyt-midi`

Reason:
These are good rollout candidates based on live checks.

Change note:
`[master-plan: build these -> changed: confirmed good candidates for rollout]`

#### Keep the planned LA Times Mini fix

Reason:
It works, but only in the planned tree.

Change note:
`[master-plan: fixed -> changed: fix exists, but not in the runtime that root workers still use]`

#### Rewrite Guardian before rollout

Reason:
The freshness idea is right, but exact date matching is missing.

Change note:
`[master-plan: switch to series page -> changed: switch to series page + exact-date validation using Guardian timestamp metadata]`

### Sources Not Re-Tested In This Review

- `washington-post-daily`
- `washington-post-mini`
- `washington-post-sunday`
- `latimes-daily`
- `usa-today-daily`

These were not the highest-risk gaps for this pass, but they should still be included in the canary suite before broad rollout.

---

## Part 2: Bugs and Plan Gaps Found

### 1. Two Active Backends With Different Truth

What I found:
The root `shared/` and root `workers/` still represent the older runtime. `plan/all-crossword-worker/` contains the newer proposed runtime and providers. The docs in the planned tree already read like the migration is done, but the actual repo is still split.

Action:
Pick one canonical backend tree before any more provider work.

Change note:
`[master-plan: implementation already applied -> changed: implementation is still split across two trees]`

### 2. Guardian Planned Fallback Is Date-Incorrect

What I found:
`plan/all-crossword-worker/shared/providers/guardian.js` improves freshness, but in the series-page branch it does not enforce exact-date matching. In live tests on `2026-05-25`, `2026-05-26`, `2026-05-27`, and `2026-05-28`, it returned the same latest puzzle title each time.

Action:

1. Extract `props.data.date` or `props.data.webPublicationDate`.
2. Convert it to `YYYY-MM-DD`.
3. Return only if it matches the requested date.
4. Otherwise continue scanning recent links, then fall back to the Content API for older dates.

Change note:
`[master-plan: series-page scraping is the fix -> changed: series-page scraping is only half the fix; date matching is mandatory]`

### 3. Cron Implementation Does Not Match the Cron Plan

What I found:
`plan/all-crossword-worker/scripts/generate.mjs` still writes the same three cron expressions for every worker. On the Workers Free plan, cron triggers are limited per account, not per worker.

Action:
Stop generating per-worker crons. Add one scheduler worker with a small number of account-level cron triggers.

Change note:
`[master-plan: exact cron per worker -> changed: exact cron per scheduler, then fan out internally]`

### 4. KV-Only Hot Caching Is Not Enough

What I found:
Both runtimes use KV hot-cache for puzzles and search, but the archive endpoints do not currently send strong public cache headers. Cache API is not implemented in the archive runtimes even though the plan treats it as the main free-tier optimization. Cache API is edge-local, not globally replicated.

Action:

1. Add `Cache-Control` and `ETag` to all public read endpoints.
2. Use Cache API as the first edge-local cache.
3. Use Pages, R2, or static JSON for global immutable archive reads and exact lookups.

Change note:
`[master-plan: Cache API is the main cache -> changed: Cache API is helpful, but static assets should carry most of the global read load]`

### 5. Write Endpoints Should Not Be GET Plus Token-In-Path

What I found:
The shared archive runtime still allows token-in-URL write operations. The root shared runtime also treats missing `API_TOKEN` as open-write access.

Action:

1. Change all write endpoints to `POST` only.
2. Accept auth only through `Authorization: Bearer ...`.
3. Reject all writes if the secret is absent.
4. Disable URL-path tokens.

Change note:
`[master-plan: protected write endpoints -> changed: harden method + auth contract]`

### 6. Legacy NYT Daily Archive Still Writes `today.json` Back To GitHub

What I found:
This adds external API dependency, extra latency, more failure modes, and more secret management. It is also not the right storage model for a Cloudflare Pages plus Workers stack.

Action:
Remove runtime GitHub writebacks and publish `latest.json` or `today.json` to R2 or Pages-managed static output instead.

Change note:
`[master-plan/current legacy behavior: worker commits to GitHub -> changed: publish inside Cloudflare, not GitHub]`

### 7. Solver Worker Still Needs Fallback Cleanup

What I found:
Local solver code still tries CrosswordNexus, then Datamuse, and only then returns internal results. Local solver code also marks internal results with `used_fallback: true`. The deployed behavior looks slightly out of sync with local config for mini lookup.

Action:

1. Exact internal results first.
2. Then cold archive or static shards.
3. Then external fallback.
4. Add one integration test proving mini exact history is present when `ENABLE_MINI_LOOKUP=true`.

Change note:
`[master-plan: prioritize internal -> changed: enforce this in both code and deployment]`

### 8. API Shape Is Still Inconsistent Across Daily and Mini Archives

What I found:
The daily archive uses the `/api/...` shape. The mini archive uses `/today`, `/date`, `/clue`, and `/answer`. The deployed daily archive also still lacked the shared-runtime `GET /api/puzzle/latest` contract during this review. The solver still has to special-case both systems.

Action:
Move the mini archive to the same shared archive contract as the rest of the system, and finish daily archive contract alignment too.

Change note:
`[master-plan: common worker framework -> changed: finish the API unification before scaling traffic]`

---

## Part 3: Revised Architecture For Free-Tier Scale

### Recommended Architecture

```text
Source fetchers -> Scheduler worker -> Per-source ingest/update jobs
                                     -> D1 (write path only / admin path)
                                     -> Static publish step (R2 or Pages assets)

Frontend / solver exact lookups -> Static JSON shards first
                                -> Archive worker read API second
                                -> External fallback last
```

### Why This Is Better

1. Read traffic is the expensive part at scale, not daily ingest.
2. Puzzle-by-date, exact clue search, and exact answer search are mostly immutable after publish.
3. Immutable data belongs on Cloudflare's cached static edge, not behind Worker plus D1 for every request.
4. The repo already has the beginning of this idea in `crossword backend solver/worker/scripts/generate-cold-archive-shards.js`.

### Concrete Read-Plane Split

#### A. Keep Workers For Ingest and Admin

- Per-source fetch and update
- Manual backfill
- Source-specific parsing
- D1 writes

#### B. Move Hot Public Reads To Static Assets

Publish these after successful ingest:

- `/archive/{source}/{date}.json`
- `/latest/{source}.json`
- `/lookup/clue/{sha1-prefix}.json`
- `/lookup/answer/{sha1-prefix}.json`

Serve them from Pages static assets or R2 with long TTLs.

#### C. Keep Workers Only For Dynamic or Slow Paths

- partial contains search
- related clues if not precomputed
- admin write paths
- source canary and health endpoints

### Recommended Source Of Truth

Use `plan/all-crossword-worker/` as the canonical next runtime, but merge in the still-working root pieces before rollout:

- keep root `usaTodayQuick`
- keep planned `latimes-mini`
- keep planned `newYorker`
- keep planned `universal`
- keep planned `newsday`
- keep planned `vox`
- keep planned `nyt-midi`
- fix planned `guardian`

Change note:
`[master-plan: grow the planned tree as-is -> changed: promote it only after merging the proven root pieces and removing drift]`

---

## Part 4: Cloudflare Free-Tier Limits That Change The Plan

These were re-checked from official Cloudflare docs during this review.

### Workers Requests

Current fact:
`100,000/day` per account.

Why it matters:
Sharding read traffic across many workers in one account does not raise this limit.

### D1

Current fact:
`5 million rows read/day` and `100,000 rows written/day`.

Why it matters:
This is fine for ingest, but hot exact lookups should not all sit on D1.

### Workers KV

Current fact:
`100,000 reads/day` and `1,000 writes/day`.

Why it matters:
KV alone is not enough to be the main cache for a large public archive.

### Cron Triggers

Current fact:
`5` per account.

Why it matters:
Per-worker cron schedules do not fit a single free account.

### Cache API

Current fact:
Useful, but edge-local and not globally replicated.

Why it matters:
It is great for local hot responses, but not enough as the only global archive cache.

### Queues

Current fact:
Available on the free plan with `10,000 ops/day`.

Why it matters:
That is enough for scheduler-to-ingest fan-out.

### What This Means For Us

- Do not optimize first by creating many separate accounts.
- First optimize by removing Worker execution from the hot read path.
- Use one scheduler worker plus queues or service-binding fan-out.
- Use static assets for exact lookups and per-date puzzle reads.

Change note:
`[master-plan: each worker in its own account for scale -> changed: static read-plane first, account sharding only if metrics prove it is necessary]`

---

## Part 5: Revised Implementation Order

### Phase 0 - Stop Drift

1. Pick one canonical runtime tree.
2. Freeze the other tree as legacy or read-only.
3. Add a migration note so future changes stop landing in both places.

### Phase 1 - Correctness First

4. Merge `usa-today-quick` into the canonical runtime and keep it.
5. Port the planned LA Times Mini fix into the canonical runtime.
6. Fix Guardian exact-date validation.
7. Standardize auth to `POST` plus bearer token only.
8. Standardize the mini archive onto the shared archive contract.

### Phase 2 - Scheduler and Deployment Cleanup

9. Replace per-worker crons with one scheduler worker.
10. Use queues or internal service-binding fan-out for provider update jobs.
11. Remove runtime GitHub `today.json` updates.

### Phase 3 - Read-Path Scale

12. Add `Cache-Control` and `ETag` to every public read endpoint.
13. Add Cache API in the archive runtime for edge-local hot caching.
14. Extend the cold-archive shard generator into a full static publish pipeline.
15. Serve exact clue and answer lookups plus per-date puzzle JSON from Pages or R2 static assets.

### Phase 4 - Solver Optimization

16. Make internal exact lookups the first return path.
17. Add static-shard lookup before any external solver fallback.
18. Add a deployed integration test for mini lookup.

### Phase 5 - Analytics Later

19. Only after the runtime is unified and the read path is mostly static, add puzzle analytics.
20. Publish analytics as static per-date JSON where possible.

Change note:
`[master-plan: analytics can be the next large feature -> changed: analytics should follow runtime unification and traffic-path simplification]`

---

## Appendix A: Smoke Test Notes From This Review

### Local Live Provider Fetches

- `root atlantic`: pass on `2026-05-25`
- `root guardian quick`: fail on `2026-05-25` through `2026-05-28`
- `plan guardian quick`: same latest puzzle returned for `2026-05-25` through `2026-05-28`
- `root latimes mini`: fail on `2026-05-25` through `2026-05-28`
- `plan latimes mini`: pass on `2026-05-25` through `2026-05-28`
- `root usa-today-quick`: pass on `2026-05-21` through `2026-05-28`
- `plan new-yorker`: pass on `2026-05-25`
- `plan universal`: pass on `2026-05-25`
- `plan vox`: pass on `2026-05-25`
- `plan newsday`: pass on `2026-05-25`
- `plan nyt-midi`: pass on `2026-05-25`

### Deployed Endpoint Checks

- `crossword-archive-worker.mitomat.workers.dev`: public read endpoints work, but archive responses did not include cache headers in this review.
- `crossword-archive-worker.mitomat.workers.dev`: `GET /api/puzzle/latest` was not available in the deployed legacy daily archive during this review.
- `nyt-mini-archive.nytsolver.workers.dev`: exact clue lookup works, but read responses also did not include cache headers in this review.
- `crossword-solver-api.mitomat.workers.dev`: solver responses did include cache headers in this review.
- The deployed solver did not surface mini history for the clue `Alternative to glossy` on `2026-05-28`, even though the mini archive returned an exact match for that clue.

---

## Appendix B: Official Docs Used To Correct The Scale Section

- Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- D1 pricing and limits: https://developers.cloudflare.com/d1/platform/pricing/
- Workers KV limits: https://developers.cloudflare.com/kv/platform/limits/
- Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Queues on free plan: https://developers.cloudflare.com/changelog/post/2026-02-04-queues-free-plan/
- Cache API behavior: https://developers.cloudflare.com/workers/runtime-apis/cache/
