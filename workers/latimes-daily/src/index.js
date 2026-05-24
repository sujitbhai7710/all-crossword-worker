import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';
import { createLatimesDailyProvider } from '../../../shared/providers/latimes.js';

export default createArchiveWorker(createLatimesDailyProvider());
