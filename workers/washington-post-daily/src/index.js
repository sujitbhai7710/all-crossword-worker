import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';
import { createWashingtonPostDailyProvider } from '../../../shared/providers/washingtonPost.js';

export default createArchiveWorker(createWashingtonPostDailyProvider());
