import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';
import { createUsaTodayDailyProvider } from '../../../shared/providers/usaToday.js';

export default createArchiveWorker(createUsaTodayDailyProvider());
