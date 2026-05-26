import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const configPath = path.join(rootDir, 'config', 'workers.json');
const workersDir = path.join(rootDir, 'workers');
const setupPath = path.join(rootDir, 'SETUP-COMMANDS.md');

const config = JSON.parse(await fs.readFile(configPath, 'utf8'));

function entrySource(worker) {
  switch (worker.family) {
    case 'atlantic':
      return `import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';\nimport { createAtlanticProvider } from '../../../shared/providers/atlantic.js';\n\nexport default createArchiveWorker(createAtlanticProvider());\n`;
    case 'guardian':
      return `import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';\nimport { createGuardianProvider } from '../../../shared/providers/guardian.js';\n\nexport default createArchiveWorker(createGuardianProvider({\n  seriesTag: '${worker.seriesTag}',\n  title: '${worker.title}'\n}));\n`;
    case 'latimes-daily':
      return `import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';\nimport { createLatimesDailyProvider } from '../../../shared/providers/latimes.js';\n\nexport default createArchiveWorker(createLatimesDailyProvider());\n`;
    case 'latimes-mini':
      return `import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';\nimport { createLatimesMiniProvider } from '../../../shared/providers/latimes.js';\n\nexport default createArchiveWorker(createLatimesMiniProvider());\n`;
    case 'usa-today-daily':
      return `import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';\nimport { createUsaTodayDailyProvider } from '../../../shared/providers/usaToday.js';\n\nexport default createArchiveWorker(createUsaTodayDailyProvider());\n`;
    case 'wapo-daily':
      return `import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';\nimport { createWashingtonPostDailyProvider } from '../../../shared/providers/washingtonPost.js';\n\nexport default createArchiveWorker(createWashingtonPostDailyProvider());\n`;
    case 'wapo-mini':
      return `import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';\nimport { createWashingtonPostMiniProvider } from '../../../shared/providers/washingtonPost.js';\n\nexport default createArchiveWorker(createWashingtonPostMiniProvider());\n`;
    case 'wapo-sunday':
      return `import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';\nimport { createWashingtonPostSundayProvider } from '../../../shared/providers/washingtonPost.js';\n\nexport default createArchiveWorker(createWashingtonPostSundayProvider());\n`;
    case 'new-yorker':
      return `import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';\nimport { createNewYorkerProvider } from '../../../shared/providers/newYorker.js';\n\nexport default createArchiveWorker(createNewYorkerProvider());\n`;
    case 'new-yorker-mini':
      return `import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';\nimport { createNewYorkerMiniProvider } from '../../../shared/providers/newYorker.js';\n\nexport default createArchiveWorker(createNewYorkerMiniProvider());\n`;
    case 'universal':
      return `import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';\nimport { createUniversalProvider } from '../../../shared/providers/universal.js';\n\nexport default createArchiveWorker(createUniversalProvider());\n`;
    case 'newsday':
      return `import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';\nimport { createNewsdayProvider } from '../../../shared/providers/newsday.js';\n\nexport default createArchiveWorker(createNewsdayProvider());\n`;
    case 'vox':
      return `import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';\nimport { createVoxProvider } from '../../../shared/providers/vox.js';\n\nexport default createArchiveWorker(createVoxProvider());\n`;
    case 'daily-pop':
      return `import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';\nimport { createDailyPopProvider } from '../../../shared/providers/dailyPop.js';\n\nexport default createArchiveWorker(createDailyPopProvider());\n`;
    case 'nyt-midi':
      return `import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';\nimport { createNytMidiProvider } from '../../../shared/providers/nyt.js';\n\nexport default createArchiveWorker(createNytMidiProvider());\n`;
    default:
      throw new Error(`Unknown worker family: ${worker.family}`);
  }
}

function wranglerToml(worker) {
  return `name = "${worker.workerName}"
main = "src/index.js"
compatibility_date = "2026-04-09"

[[d1_databases]]
binding = "DB"
database_name = "${worker.databaseName}"
database_id = "REPLACE_WITH_D1_DATABASE_ID"

[[kv_namespaces]]
binding = "HOT_CACHE"
id = "REPLACE_WITH_KV_NAMESPACE_ID"
preview_id = "REPLACE_WITH_KV_PREVIEW_NAMESPACE_ID"

[triggers]
crons = [
  "0 0 * * *",
  "30 4 * * *",
  "30 9 * * *"
]
`;
}

function setupCommands(workers) {
  const sections = [
    '# Setup Commands',
    '',
    'Run these from `all-crossword-worker/` after `npm run generate`.',
    '',
    'Shared migration files:',
    '',
    '- `shared/migrations/0000_initial_migration.sql`',
    '- `shared/migrations/0001_normalized_lookup_columns.sql`',
    '',
    'Optional secret for all workers:',
    '',
    '- `API_TOKEN`: protects write endpoints such as `/api/add/...`, `/api/update/latest/...`, and `/api/delete/...`.',
    '- `GUARDIAN_API_KEY`: optional for Guardian workers. If omitted, the public `test` key is used.',
    ''
  ];

  for (const worker of workers) {
    sections.push(`## ${worker.name}`);
    sections.push('');
    sections.push('```powershell');
    sections.push(`cd workers/${worker.slug}`);
    sections.push(`npx wrangler d1 create ${worker.databaseName}`);
    sections.push('# Copy the returned database_id into wrangler.toml');
    sections.push('npx wrangler kv namespace create HOT_CACHE');
    sections.push('# Copy the returned id into wrangler.toml as HOT_CACHE.id');
    sections.push('npx wrangler kv namespace create HOT_CACHE --preview');
    sections.push('# Copy the returned id into wrangler.toml as HOT_CACHE.preview_id');
    sections.push('npx wrangler secret put API_TOKEN');
    if (worker.family === 'guardian') {
      sections.push('# Optional: only if you want your own Guardian API key');
      sections.push('# npx wrangler secret put GUARDIAN_API_KEY');
    }
    sections.push(`npx wrangler d1 execute ${worker.databaseName} --file=../../shared/migrations/0000_initial_migration.sql --remote`);
    sections.push(`npx wrangler d1 execute ${worker.databaseName} --file=../../shared/migrations/0001_normalized_lookup_columns.sql --remote`);
    sections.push('npx wrangler deploy');
    sections.push('```');
    sections.push('');
  }

  return sections.join('\n');
}

await fs.mkdir(workersDir, { recursive: true });

for (const worker of config.workers) {
  const projectDir = path.join(workersDir, worker.slug);
  const srcDir = path.join(projectDir, 'src');
  await fs.mkdir(srcDir, { recursive: true });
  await fs.writeFile(path.join(srcDir, 'index.js'), entrySource(worker));
  await fs.writeFile(path.join(projectDir, 'wrangler.toml'), wranglerToml(worker));
}

await fs.writeFile(setupPath, setupCommands(config.workers));
