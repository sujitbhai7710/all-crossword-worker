/**
 * Script to delete all data from the local D1 database
 * Use this if you want to start fresh or if you're migrating directly to remote
 */

const { execSync } = require('child_process');

// Configuration
const D1_DATABASE_NAME = 'crossword_archive';

console.log('Deleting all local data from D1 database...');

try {
  // Delete all clues
  console.log('Deleting clues table data...');
  execSync(`npx wrangler@4 d1 execute ${D1_DATABASE_NAME} --command="DELETE FROM clues;"`, { stdio: 'inherit' });
  
  // Delete all puzzles
  console.log('Deleting puzzles table data...');
  execSync(`npx wrangler@4 d1 execute ${D1_DATABASE_NAME} --command="DELETE FROM puzzles;"`, { stdio: 'inherit' });
  
  // Verify deletion
  console.log('Verifying deletion...');
  const puzzleCount = execSync(`npx wrangler@4 d1 execute ${D1_DATABASE_NAME} --command="SELECT COUNT(*) FROM puzzles;" --json`, { encoding: 'utf8' });
  const clueCount = execSync(`npx wrangler@4 d1 execute ${D1_DATABASE_NAME} --command="SELECT COUNT(*) FROM clues;" --json`, { encoding: 'utf8' });
  
  console.log('Local data deletion complete.');
  console.log(`Local database now contains: ${puzzleCount}, ${clueCount}`);
  
} catch (error) {
  console.error('Error deleting data:', error);
}

console.log('Done!'); 