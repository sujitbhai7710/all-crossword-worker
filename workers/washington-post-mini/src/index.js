import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';
import { createWashingtonPostMiniProvider } from '../../../shared/providers/washingtonPost.js';

export default createArchiveWorker(createWashingtonPostMiniProvider());
