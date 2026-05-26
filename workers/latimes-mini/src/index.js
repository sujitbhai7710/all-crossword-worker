import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';
import { createLatimesMiniProvider } from '../../../shared/providers/latimes.js';

export default createArchiveWorker(createLatimesMiniProvider());
