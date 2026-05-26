import { createArchiveWorker } from '../../../shared/core/createArchiveWorker.js';
import { createNytMidiProvider } from '../../../shared/providers/nyt.js';

export default createArchiveWorker(createNytMidiProvider());
