import {
  cleanClueText,
  decodeHtmlEntities,
  fetchJson,
  fetchText,
  getDayOfWeek,
  getFormattedDate,
  normalizePuzzlePayload,
  notFound
} from '../core/utils.js';

function guardianApiUrl(seriesTag, date, apiKey) {
  const params = new URLSearchParams({
    tag: `crosswords/series/${seriesTag}`,
    'from-date': date,
    'to-date': date,
    'page-size': '1',
    'api-key': apiKey || 'test'
  });

  return `https://content.guardianapis.com/search?${params.toString()}`;
}

async function fetchGuardianPuzzleReference(seriesTag, date, apiKey) {
  const json = await fetchJson(guardianApiUrl(seriesTag, date, apiKey));
  const result = json.response?.results?.[0];
  if (!result) {
    throw notFound(`No Guardian ${seriesTag} puzzle for ${date}`);
  }
  return result;
}

function decodeIslandProps(encodedProps) {
  return JSON.parse(decodeHtmlEntities(encodedProps));
}

async function fetchGuardianPageData(webUrl) {
  const html = await fetchText(webUrl);
  const islandMatch = html.match(/<gu-island[^>]*name="CrosswordComponent"[^>]*props="([^"]*)"/i);

  if (!islandMatch) {
    throw new Error(`Guardian page did not include crossword props: ${webUrl}`);
  }

  const props = decodeIslandProps(islandMatch[1]);
  return props.data;
}

function parseGuardianPuzzle(pageData, date, permalink, fallbackTitle) {
  const clues = (pageData.entries || [])
    .map((entry) => {
      let clueText = cleanClueText(entry.clue || '');
      clueText = clueText.replace(/\s*\([\d,\- ]+\)\s*$/, '').trim();

      return {
        number: Number.parseInt(entry.number, 10),
        direction: entry.direction,
        clue_text: clueText,
        answer: decodeHtmlEntities(String(entry.solution || '')).trim()
      };
    })
    .filter((clue) => clue.number && clue.clue_text && clue.answer);

  return normalizePuzzlePayload({
    date,
    formatted_date: getFormattedDate(date),
    title: pageData.name || fallbackTitle,
    author: pageData.creator?.name || '',
    editor: '',
    day_of_week: getDayOfWeek(date),
    permalink,
    clues
  });
}

export function createGuardianProvider({ seriesTag, title, lookbackDays = 21 }) {
  return {
    slug: `guardian-${seriesTag}`,
    title,
    lookbackDays,
    async fetchByDate(date, env) {
      const result = await fetchGuardianPuzzleReference(seriesTag, date, env.GUARDIAN_API_KEY);
      const pageData = await fetchGuardianPageData(result.webUrl);
      return parseGuardianPuzzle(pageData, date, result.webUrl, result.webTitle || title);
    }
  };
}
