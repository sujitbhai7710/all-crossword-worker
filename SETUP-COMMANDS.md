# Setup Commands

Run these from `all-crossword-worker/` after `npm run generate`.

Shared migration files:

- `shared/migrations/0000_initial_migration.sql`
- `shared/migrations/0001_normalized_lookup_columns.sql`

Optional secret for all workers:

- `API_TOKEN`: protects write endpoints such as `/api/add/...`, `/api/update/latest/...`, and `/api/delete/...`.
- `GUARDIAN_API_KEY`: optional for Guardian workers. If omitted, the public `test` key is used.

## Atlantic Crossword

```powershell
cd workers/atlantic
npx wrangler d1 create atlantic_crossword_archive
# Copy the returned database_id into wrangler.toml
npx wrangler kv namespace create HOT_CACHE
# Copy the returned id into wrangler.toml as HOT_CACHE.id
npx wrangler kv namespace create HOT_CACHE --preview
# Copy the returned id into wrangler.toml as HOT_CACHE.preview_id
npx wrangler secret put API_TOKEN
npx wrangler d1 execute atlantic_crossword_archive --file=../../shared/migrations/0000_initial_migration.sql --remote
npx wrangler d1 execute atlantic_crossword_archive --file=../../shared/migrations/0001_normalized_lookup_columns.sql --remote
npx wrangler deploy
```

## Guardian Cryptic

```powershell
cd workers/guardian-cryptic
npx wrangler d1 create guardian_cryptic_archive
# Copy the returned database_id into wrangler.toml
npx wrangler kv namespace create HOT_CACHE
# Copy the returned id into wrangler.toml as HOT_CACHE.id
npx wrangler kv namespace create HOT_CACHE --preview
# Copy the returned id into wrangler.toml as HOT_CACHE.preview_id
npx wrangler secret put API_TOKEN
# Optional: only if you want your own Guardian API key
# npx wrangler secret put GUARDIAN_API_KEY
npx wrangler d1 execute guardian_cryptic_archive --file=../../shared/migrations/0000_initial_migration.sql --remote
npx wrangler d1 execute guardian_cryptic_archive --file=../../shared/migrations/0001_normalized_lookup_columns.sql --remote
npx wrangler deploy
```

## Guardian Prize

```powershell
cd workers/guardian-prize
npx wrangler d1 create guardian_prize_archive
# Copy the returned database_id into wrangler.toml
npx wrangler kv namespace create HOT_CACHE
# Copy the returned id into wrangler.toml as HOT_CACHE.id
npx wrangler kv namespace create HOT_CACHE --preview
# Copy the returned id into wrangler.toml as HOT_CACHE.preview_id
npx wrangler secret put API_TOKEN
# Optional: only if you want your own Guardian API key
# npx wrangler secret put GUARDIAN_API_KEY
npx wrangler d1 execute guardian_prize_archive --file=../../shared/migrations/0000_initial_migration.sql --remote
npx wrangler d1 execute guardian_prize_archive --file=../../shared/migrations/0001_normalized_lookup_columns.sql --remote
npx wrangler deploy
```

## Guardian Quick

```powershell
cd workers/guardian-quick
npx wrangler d1 create guardian_quick_archive
# Copy the returned database_id into wrangler.toml
npx wrangler kv namespace create HOT_CACHE
# Copy the returned id into wrangler.toml as HOT_CACHE.id
npx wrangler kv namespace create HOT_CACHE --preview
# Copy the returned id into wrangler.toml as HOT_CACHE.preview_id
npx wrangler secret put API_TOKEN
# Optional: only if you want your own Guardian API key
# npx wrangler secret put GUARDIAN_API_KEY
npx wrangler d1 execute guardian_quick_archive --file=../../shared/migrations/0000_initial_migration.sql --remote
npx wrangler d1 execute guardian_quick_archive --file=../../shared/migrations/0001_normalized_lookup_columns.sql --remote
npx wrangler deploy
```

## Guardian Quiptic

```powershell
cd workers/guardian-quiptic
npx wrangler d1 create guardian_quiptic_archive
# Copy the returned database_id into wrangler.toml
npx wrangler kv namespace create HOT_CACHE
# Copy the returned id into wrangler.toml as HOT_CACHE.id
npx wrangler kv namespace create HOT_CACHE --preview
# Copy the returned id into wrangler.toml as HOT_CACHE.preview_id
npx wrangler secret put API_TOKEN
# Optional: only if you want your own Guardian API key
# npx wrangler secret put GUARDIAN_API_KEY
npx wrangler d1 execute guardian_quiptic_archive --file=../../shared/migrations/0000_initial_migration.sql --remote
npx wrangler d1 execute guardian_quiptic_archive --file=../../shared/migrations/0001_normalized_lookup_columns.sql --remote
npx wrangler deploy
```

## Guardian Weekend

```powershell
cd workers/guardian-weekend
npx wrangler d1 create guardian_weekend_archive
# Copy the returned database_id into wrangler.toml
npx wrangler kv namespace create HOT_CACHE
# Copy the returned id into wrangler.toml as HOT_CACHE.id
npx wrangler kv namespace create HOT_CACHE --preview
# Copy the returned id into wrangler.toml as HOT_CACHE.preview_id
npx wrangler secret put API_TOKEN
# Optional: only if you want your own Guardian API key
# npx wrangler secret put GUARDIAN_API_KEY
npx wrangler d1 execute guardian_weekend_archive --file=../../shared/migrations/0000_initial_migration.sql --remote
npx wrangler d1 execute guardian_weekend_archive --file=../../shared/migrations/0001_normalized_lookup_columns.sql --remote
npx wrangler deploy
```

## LA Times Daily

```powershell
cd workers/latimes-daily
npx wrangler d1 create latimes_daily_archive
# Copy the returned database_id into wrangler.toml
npx wrangler kv namespace create HOT_CACHE
# Copy the returned id into wrangler.toml as HOT_CACHE.id
npx wrangler kv namespace create HOT_CACHE --preview
# Copy the returned id into wrangler.toml as HOT_CACHE.preview_id
npx wrangler secret put API_TOKEN
npx wrangler d1 execute latimes_daily_archive --file=../../shared/migrations/0000_initial_migration.sql --remote
npx wrangler d1 execute latimes_daily_archive --file=../../shared/migrations/0001_normalized_lookup_columns.sql --remote
npx wrangler deploy
```

## LA Times Mini

```powershell
cd workers/latimes-mini
npx wrangler d1 create latimes_mini_archive
# Copy the returned database_id into wrangler.toml
npx wrangler kv namespace create HOT_CACHE
# Copy the returned id into wrangler.toml as HOT_CACHE.id
npx wrangler kv namespace create HOT_CACHE --preview
# Copy the returned id into wrangler.toml as HOT_CACHE.preview_id
npx wrangler secret put API_TOKEN
npx wrangler d1 execute latimes_mini_archive --file=../../shared/migrations/0000_initial_migration.sql --remote
npx wrangler d1 execute latimes_mini_archive --file=../../shared/migrations/0001_normalized_lookup_columns.sql --remote
npx wrangler deploy
```

## USA Today Daily

```powershell
cd workers/usa-today-daily
npx wrangler d1 create usa_today_daily_archive
# Copy the returned database_id into wrangler.toml
npx wrangler kv namespace create HOT_CACHE
# Copy the returned id into wrangler.toml as HOT_CACHE.id
npx wrangler kv namespace create HOT_CACHE --preview
# Copy the returned id into wrangler.toml as HOT_CACHE.preview_id
npx wrangler secret put API_TOKEN
npx wrangler d1 execute usa_today_daily_archive --file=../../shared/migrations/0000_initial_migration.sql --remote
npx wrangler d1 execute usa_today_daily_archive --file=../../shared/migrations/0001_normalized_lookup_columns.sql --remote
npx wrangler deploy
```

## Washington Post Daily

```powershell
cd workers/washington-post-daily
npx wrangler d1 create washington_post_daily_archive
# Copy the returned database_id into wrangler.toml
npx wrangler kv namespace create HOT_CACHE
# Copy the returned id into wrangler.toml as HOT_CACHE.id
npx wrangler kv namespace create HOT_CACHE --preview
# Copy the returned id into wrangler.toml as HOT_CACHE.preview_id
npx wrangler secret put API_TOKEN
npx wrangler d1 execute washington_post_daily_archive --file=../../shared/migrations/0000_initial_migration.sql --remote
npx wrangler d1 execute washington_post_daily_archive --file=../../shared/migrations/0001_normalized_lookup_columns.sql --remote
npx wrangler deploy
```

## Washington Post Mini

```powershell
cd workers/washington-post-mini
npx wrangler d1 create washington_post_mini_archive
# Copy the returned database_id into wrangler.toml
npx wrangler kv namespace create HOT_CACHE
# Copy the returned id into wrangler.toml as HOT_CACHE.id
npx wrangler kv namespace create HOT_CACHE --preview
# Copy the returned id into wrangler.toml as HOT_CACHE.preview_id
npx wrangler secret put API_TOKEN
npx wrangler d1 execute washington_post_mini_archive --file=../../shared/migrations/0000_initial_migration.sql --remote
npx wrangler d1 execute washington_post_mini_archive --file=../../shared/migrations/0001_normalized_lookup_columns.sql --remote
npx wrangler deploy
```

## Washington Post Sunday

```powershell
cd workers/washington-post-sunday
npx wrangler d1 create washington_post_sunday_archive
# Copy the returned database_id into wrangler.toml
npx wrangler kv namespace create HOT_CACHE
# Copy the returned id into wrangler.toml as HOT_CACHE.id
npx wrangler kv namespace create HOT_CACHE --preview
# Copy the returned id into wrangler.toml as HOT_CACHE.preview_id
npx wrangler secret put API_TOKEN
npx wrangler d1 execute washington_post_sunday_archive --file=../../shared/migrations/0000_initial_migration.sql --remote
npx wrangler d1 execute washington_post_sunday_archive --file=../../shared/migrations/0001_normalized_lookup_columns.sql --remote
npx wrangler deploy
```

## New Yorker

```powershell
cd workers/new-yorker
npx wrangler d1 create new_yorker_crossword_archive
# Copy the returned database_id into wrangler.toml
npx wrangler kv namespace create HOT_CACHE
# Copy the returned id into wrangler.toml as HOT_CACHE.id
npx wrangler kv namespace create HOT_CACHE --preview
# Copy the returned id into wrangler.toml as HOT_CACHE.preview_id
npx wrangler secret put API_TOKEN
npx wrangler d1 execute new_yorker_crossword_archive --file=../../shared/migrations/0000_initial_migration.sql --remote
npx wrangler d1 execute new_yorker_crossword_archive --file=../../shared/migrations/0001_normalized_lookup_columns.sql --remote
npx wrangler deploy
```

## New Yorker Mini

```powershell
cd workers/new-yorker-mini
npx wrangler d1 create new_yorker_mini_archive
# Copy the returned database_id into wrangler.toml
npx wrangler kv namespace create HOT_CACHE
# Copy the returned id into wrangler.toml as HOT_CACHE.id
npx wrangler kv namespace create HOT_CACHE --preview
# Copy the returned id into wrangler.toml as HOT_CACHE.preview_id
npx wrangler secret put API_TOKEN
npx wrangler d1 execute new_yorker_mini_archive --file=../../shared/migrations/0000_initial_migration.sql --remote
npx wrangler d1 execute new_yorker_mini_archive --file=../../shared/migrations/0001_normalized_lookup_columns.sql --remote
npx wrangler deploy
```

## Universal

```powershell
cd workers/universal
npx wrangler d1 create universal_crossword_archive
# Copy the returned database_id into wrangler.toml
npx wrangler kv namespace create HOT_CACHE
# Copy the returned id into wrangler.toml as HOT_CACHE.id
npx wrangler kv namespace create HOT_CACHE --preview
# Copy the returned id into wrangler.toml as HOT_CACHE.preview_id
npx wrangler secret put API_TOKEN
npx wrangler d1 execute universal_crossword_archive --file=../../shared/migrations/0000_initial_migration.sql --remote
npx wrangler d1 execute universal_crossword_archive --file=../../shared/migrations/0001_normalized_lookup_columns.sql --remote
npx wrangler deploy
```

## Newsday

```powershell
cd workers/newsday
npx wrangler d1 create newsday_crossword_archive
# Copy the returned database_id into wrangler.toml
npx wrangler kv namespace create HOT_CACHE
# Copy the returned id into wrangler.toml as HOT_CACHE.id
npx wrangler kv namespace create HOT_CACHE --preview
# Copy the returned id into wrangler.toml as HOT_CACHE.preview_id
npx wrangler secret put API_TOKEN
npx wrangler d1 execute newsday_crossword_archive --file=../../shared/migrations/0000_initial_migration.sql --remote
npx wrangler d1 execute newsday_crossword_archive --file=../../shared/migrations/0001_normalized_lookup_columns.sql --remote
npx wrangler deploy
```

## Vox

```powershell
cd workers/vox
npx wrangler d1 create vox_crossword_archive
# Copy the returned database_id into wrangler.toml
npx wrangler kv namespace create HOT_CACHE
# Copy the returned id into wrangler.toml as HOT_CACHE.id
npx wrangler kv namespace create HOT_CACHE --preview
# Copy the returned id into wrangler.toml as HOT_CACHE.preview_id
npx wrangler secret put API_TOKEN
npx wrangler d1 execute vox_crossword_archive --file=../../shared/migrations/0000_initial_migration.sql --remote
npx wrangler d1 execute vox_crossword_archive --file=../../shared/migrations/0001_normalized_lookup_columns.sql --remote
npx wrangler deploy
```

## Daily Pop

```powershell
cd workers/daily-pop
npx wrangler d1 create daily_pop_archive
# Copy the returned database_id into wrangler.toml
npx wrangler kv namespace create HOT_CACHE
# Copy the returned id into wrangler.toml as HOT_CACHE.id
npx wrangler kv namespace create HOT_CACHE --preview
# Copy the returned id into wrangler.toml as HOT_CACHE.preview_id
npx wrangler secret put API_TOKEN
npx wrangler d1 execute daily_pop_archive --file=../../shared/migrations/0000_initial_migration.sql --remote
npx wrangler d1 execute daily_pop_archive --file=../../shared/migrations/0001_normalized_lookup_columns.sql --remote
npx wrangler deploy
```

## NYT Midi

```powershell
cd workers/nyt-midi
npx wrangler d1 create nyt_midi_archive
# Copy the returned database_id into wrangler.toml
npx wrangler kv namespace create HOT_CACHE
# Copy the returned id into wrangler.toml as HOT_CACHE.id
npx wrangler kv namespace create HOT_CACHE --preview
# Copy the returned id into wrangler.toml as HOT_CACHE.preview_id
npx wrangler secret put API_TOKEN
npx wrangler d1 execute nyt_midi_archive --file=../../shared/migrations/0000_initial_migration.sql --remote
npx wrangler d1 execute nyt_midi_archive --file=../../shared/migrations/0001_normalized_lookup_columns.sql --remote
npx wrangler deploy
```
