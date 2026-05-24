import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';
import { createAtlanticProvider } from '../../../shared/providers/atlantic.js';

export default createArchiveWorker(createAtlanticProvider());
