import {
  fetchText,
  getDayOfWeek,
  getFormattedDate,
  normalizePuzzlePayload,
  notFound
} from '../core/utils.js';
import { fetchAmuseLabsPuzzle } from '../core/amuselabs.js';

/**
 * Compute the AmuseLabs fvlt (fingerprint verification load token).
 * Algorithm: fvlt = (hash(set) ^ hash(puzzleId) ^ hash(uid)) as hex string
 */
function computeFvlt(set, puzzleId, uid) {
  const hash = (str) => {
    let t = 0;
    for (let n = 0; n < str.length; n++) {
      t = (t + str.charCodeAt(n)) >>> 0;
    }
    return t;
  };
  return ((hash(set) ^ hash(puzzleId) ^ hash(uid)) >>> 0).toString(16);
}

/**
 * Find the puzzle ID for a given date from the picker's streakInfo.
 * Newsday puzzle IDs may vary in format.
 */
function findPuzzleId(pickerHtml, date) {
  const compact = date.replace(/-/g, '');
  const matches = [...pickerHtml.matchAll(/"puzzleId":"([^"]+)"/g)];
  for (const m of matches) {
    if (m[1].includes(compact)) {
      return m[1];
    }
  }
  return null;
}

export function createNewsdayProvider() {
  return {
    slug: 'newsday',
    title: 'Newsday Crossword',
    lookbackDays: 14,
    async fetchByDate(date, env) {
      const compact = date.replace(/-/g, '');
      const set = 'creatorsweb';
      const defaultPuzzleId = `Creators_WEB_${compact}`;

      const pickerHtml = await fetchText(
        'https://cdn2.amuselabs.com/pmm/date-picker?set=creatorsweb'
      );

      // Extract loadToken and uid from the picker's params
      let loadToken = '';
      let uid = '';
      const pm = pickerHtml.match(/<script[^>]*id="params"[^>]*>([\s\S]*?)<\/script>/i);
      if (pm) {
        try {
          const params = JSON.parse(pm[1]);
          if (params.rawsps) {
            const decoded = JSON.parse(atob(params.rawsps));
            loadToken = decoded.loadToken || '';
          }
        } catch (e) {}
      }

      // Parse uid from JWT loadToken
      if (loadToken) {
        try {
          const jwtPayload = JSON.parse(atob(loadToken.split('.')[1]));
          uid = jwtPayload.uid || '';
        } catch (e) {}
      }

      // Try to find the actual puzzle ID from the picker, fall back to default
      const puzzleId = findPuzzleId(pickerHtml, date) || defaultPuzzleId;

      // Compute fvlt for verification
      const fvlt = uid ? computeFvlt(set, puzzleId, uid) : '';

      let url = `https://cdn2.amuselabs.com/pmm/crossword?id=${puzzleId}&set=${set}`;
      if (loadToken) url += `&loadToken=${encodeURIComponent(loadToken)}`;
      if (fvlt) url += `&fvlt=${fvlt}`;

      return fetchAmuseLabsPuzzle({
        url,
        date,
        defaults: {
          title: 'Newsday Crossword',
          formatted_date: getFormattedDate(date),
          day_of_week: getDayOfWeek(date),
          permalink: url
        }
      });
    }
  };
}
