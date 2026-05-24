import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';
import { createUsaTodayQuickProvider } from '../../../shared/providers/usaToday.js';

export default createArchiveWorker(createUsaTodayQuickProvider());
