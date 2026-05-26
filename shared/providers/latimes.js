import { fetchAmuseLabsPuzzle } from '../core/amuselabs.js';
import {
  fetchText,
  getDayOfWeek,
  getFormattedDate,
  normalizePuzzlePayload,
  notFound,
  xmlAttribute
} from '../core/utils.js';

function buildLegacyXmlDate(date) {
  return `${date.slice(2, 4)}${date.slice(5, 7)}${date.slice(8, 10)}`;
}

function extractTag(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*v="([^"]*)"`, 'i'));
  return match ? xmlAttribute(match[0], 'v') : '';
}

export function createLatimesDailyProvider() {
  return {
    slug: 'latimes-daily',
    title: 'Los Angeles Times Daily Crossword',
    lookbackDays: 14,
    async fetchByDate(date) {
      const code = buildLegacyXmlDate(date);
      const url = `http://picayune.uclick.com/comics/tmcal/data/tmcal${code}-data.xml`;
      const xml = await fetchText(url);

      if (!xml.includes('<crossword')) {
        throw notFound(`No LA Times daily puzzle for ${date}`);
      }

      const getBlock = (tag) => {
        const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
        return match ? match[1] : '';
      };

      const parseBlock = (content, direction) => {
        const matches = [...content.matchAll(/<[ad]\d+\s+([^>]+)\/>/gi)];
        return matches.map((match) => {
          const attrs = match[1];
          return {
            number: Number.parseInt(xmlAttribute(attrs, 'cn'), 10),
            direction,
            clue_text: xmlAttribute(attrs, 'c'),
            answer: xmlAttribute(attrs, 'a')
          };
        });
      };

      return normalizePuzzlePayload({
        date,
        formatted_date: getFormattedDate(date),
        title: extractTag(xml, 'Title') || 'Los Angeles Times Daily Crossword',
        author: extractTag(xml, 'Author'),
        editor: extractTag(xml, 'Editor').replace(/^Ed\.\s*/i, ''),
        day_of_week: getDayOfWeek(date),
        permalink: url,
        clues: [
          ...parseBlock(getBlock('across'), 'across'),
          ...parseBlock(getBlock('down'), 'down')
        ]
      });
    }
  };
}

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

async function getLatMiniLoadToken() {
  const pickerUrl = 'https://lat.amuselabs.com/lat/date-picker?set=latimes-mini';
  const pickerHtml = await fetchText(pickerUrl, {
    headers: {
      Referer: 'https://www.latimes.com/games/mini-crossword',
      Origin: 'https://www.latimes.com'
    }
  });

  const scriptMatch = pickerHtml.match(/<script[^>]*id="params"[^>]*>([\s\S]*?)<\/script>/i);
  if (!scriptMatch) {
    return { loadToken: '', uid: '' };
  }

  const paramsBlob = JSON.parse(scriptMatch[1]);
  if (!paramsBlob.rawsps) {
    return { loadToken: '', uid: '' };
  }

  const decoded = JSON.parse(atob(paramsBlob.rawsps));
  const loadToken = decoded.loadToken || '';

  // Parse uid from JWT loadToken
  let uid = '';
  if (loadToken) {
    try {
      const jwtPayload = JSON.parse(atob(loadToken.split('.')[1]));
      uid = jwtPayload.uid || '';
    } catch (e) {}
  }

  return { loadToken, uid };
}

export function createLatimesMiniProvider() {
  return {
    slug: 'latimes-mini',
    title: 'LA Times Mini',
    lookbackDays: 14,
    async fetchByDate(date) {
      const compact = date.replace(/-/g, '');
      const set = 'latimes-mini';
      const puzzleId = `latimes-mini-${compact}`;
      const { loadToken, uid } = await getLatMiniLoadToken();

      let url = `https://lat.amuselabs.com/lat/crossword?id=${puzzleId}&set=${set}`;

      if (loadToken) {
        url += `&loadToken=${encodeURIComponent(loadToken)}`;
      }

      if (uid) {
        const fvlt = computeFvlt(set, puzzleId, uid);
        url += `&fvlt=${fvlt}`;
      }

      return fetchAmuseLabsPuzzle({
        url,
        date,
        defaults: {
          title: 'LA Times Mini',
          formatted_date: getFormattedDate(date),
          day_of_week: getDayOfWeek(date),
          permalink: url
        }
      });
    }
  };
}
