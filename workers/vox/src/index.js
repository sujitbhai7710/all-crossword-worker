import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';
import { createVoxProvider } from '../../../shared/providers/vox.js';

export default createArchiveWorker(createVoxProvider());
