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
 * where hash(s) = sum of char codes (unsigned 32-bit).
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
 * Puzzle IDs vary by author prefix (e.g. PBvox_, AJRvox_, WNvox_).
 */
function findPuzzleId(pickerHtml, date) {
  const compact = date.replace(/-/g, '');
  // Match puzzleId fields like "PBvox_20260525_1000"
  const matches = [...pickerHtml.matchAll(/"puzzleId":"([^"]+)"/g)];
  for (const m of matches) {
    if (m[1].includes(compact)) {
      return m[1];
    }
  }
  return null;
}

export function createVoxProvider() {
  return {
    slug: 'vox',
    title: 'Vox Crossword',
    lookbackDays: 14,
    async fetchByDate(date, env) {
      const pickerUrl = 'https://cdn3.amuselabs.com/vox/date-picker?set=vox';
      const pickerHtml = await fetchText(pickerUrl);

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

      // Find the puzzle ID for this date from the picker's streakInfo
      const puzzleId = findPuzzleId(pickerHtml, date);
      if (!puzzleId) {
        throw notFound(`No Vox puzzle found for ${date}`);
      }

      // Compute fvlt for verification
      const set = 'vox';
      const fvlt = uid ? computeFvlt(set, puzzleId, uid) : '';

      let url = `https://cdn3.amuselabs.com/vox/crossword?id=${puzzleId}&set=${set}`;
      if (loadToken) url += `&loadToken=${encodeURIComponent(loadToken)}`;
      if (fvlt) url += `&fvlt=${fvlt}`;

      return fetchAmuseLabsPuzzle({
        url,
        date,
        defaults: {
          title: 'Vox Crossword',
          formatted_date: getFormattedDate(date),
          day_of_week: getDayOfWeek(date),
          permalink: url
        }
      });
    }
  };
}
