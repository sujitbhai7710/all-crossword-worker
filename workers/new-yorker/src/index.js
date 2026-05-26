import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';
import { createNewYorkerProvider } from '../../../shared/providers/newYorker.js';

export default createArchiveWorker(createNewYorkerProvider());
