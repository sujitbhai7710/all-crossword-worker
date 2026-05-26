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
    return null;
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

// Series page approach — scrapes the series landing page to find puzzle URLs
// This is more reliable than the Content API which has a 3-7 day indexing lag

// Some series have URL slugs that differ from their series tag
const SERIES_URL_OVERRIDES = {
  'weekend-crossword': 'weekend',
};

async function fetchGuardianPuzzleFromSeriesPage(seriesTag, date) {
  const seriesUrl = `https://www.theguardian.com/crosswords/series/${seriesTag}`;
  const seriesHtml = await fetchText(seriesUrl);

  // The URL pattern for puzzle links may differ from the series tag
  // e.g., series "weekend-crossword" has URLs "/crosswords/weekend/{number}"
  const urlSlug = SERIES_URL_OVERRIDES[seriesTag] || seriesTag;

  // Extract puzzle URLs from the series page
  const urlMatches = [...seriesHtml.matchAll(
    new RegExp(`href="(/crosswords/${urlSlug}/\\d+)"`, 'g')
  )];

  if (urlMatches.length === 0) {
    return null;
  }

  // Check the first few puzzles for a matching date
  for (const match of urlMatches.slice(0, 5)) {
    const puzzleUrl = `https://www.theguardian.com${match[1]}`;
    try {
      const puzzleHtml = await fetchText(puzzleUrl);

      // Extract the gu-island CrosswordComponent
      const islandMatch = puzzleHtml.match(/<gu-island[^>]*name="CrosswordComponent"[^>]*props="([^"]*)"/i);
      if (!islandMatch) continue;

      const props = decodeIslandProps(islandMatch[1]);
      const pageData = props.data;
      if (!pageData) continue;

      // Check if this puzzle has the date we need (or is the most recent)
      return parseGuardianPuzzle(pageData, date, puzzleUrl, `Guardian ${seriesTag} crossword`);
    } catch (e) {
      continue;
    }
  }

  return null;
}

export function createGuardianProvider({ seriesTag, title, lookbackDays = 21 }) {
  return {
    slug: `guardian-${seriesTag}`,
    title,
    lookbackDays,
    async fetchByDate(date, env) {
      // Primary: Try Content API first (works well for historical dates)
      try {
        const result = await fetchGuardianPuzzleReference(seriesTag, date, env.GUARDIAN_API_KEY);
        if (result) {
          const pageData = await fetchGuardianPageData(result.webUrl);
          return parseGuardianPuzzle(pageData, date, result.webUrl, result.webTitle || title);
        }
      } catch (e) {
        // Content API failed or returned 0 results — fall through to series page
      }

      // Fallback: Try series page scraping (works for recent puzzles with no API lag)
      try {
        const puzzle = await fetchGuardianPuzzleFromSeriesPage(seriesTag, date);
        if (puzzle) {
          return puzzle;
        }
      } catch (e) {
        // Series page also failed
      }

      throw notFound(`No Guardian ${seriesTag} puzzle for ${date}`);
    }
  };
}
