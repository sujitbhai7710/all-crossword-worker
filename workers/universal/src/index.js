import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';
import { createUniversalProvider } from '../../../shared/providers/universal.js';

export default createArchiveWorker(createUniversalProvider());
