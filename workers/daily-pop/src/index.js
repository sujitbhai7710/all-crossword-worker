import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';
import { createDailyPopProvider } from '../../../shared/providers/dailyPop.js';

export default createArchiveWorker(createDailyPopProvider());
