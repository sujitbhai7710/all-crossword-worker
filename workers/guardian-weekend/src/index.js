import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';
import { createGuardianProvider } from '../../../shared/providers/guardian.js';

export default createArchiveWorker(createGuardianProvider({
  seriesTag: 'weekend-crossword',
  title: 'Guardian Weekend Crossword'
}));
