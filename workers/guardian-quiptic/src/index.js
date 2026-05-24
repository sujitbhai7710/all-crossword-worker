import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';
import { createGuardianProvider } from '../../../shared/providers/guardian.js';

export default createArchiveWorker(createGuardianProvider({
  seriesTag: 'quiptic',
  title: 'Guardian Quiptic Crossword'
}));
