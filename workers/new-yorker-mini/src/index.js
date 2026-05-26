import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';
import { createNewYorkerMiniProvider } from '../../../shared/providers/newYorker.js';

export default createArchiveWorker(createNewYorkerMiniProvider());
