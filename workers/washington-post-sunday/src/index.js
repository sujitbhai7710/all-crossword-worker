import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';
import { createWashingtonPostSundayProvider } from '../../../shared/providers/washingtonPost.js';

export default createArchiveWorker(createWashingtonPostSundayProvider());
