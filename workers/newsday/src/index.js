import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';
import { createNewsdayProvider } from '../../../shared/providers/newsday.js';

export default createArchiveWorker(createNewsdayProvider());
