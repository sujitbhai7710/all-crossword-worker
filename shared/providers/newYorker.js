import {
  fetchText,
  fetchJson,
  getDayOfWeek,
  getFormattedDate,
  normalizePuzzlePayload,
  notFound
} from '../core/utils.js';

function parseXdFormat(xdText, date) {
  const sections = {};
  let currentSection = '';
  for (const line of xdText.split('\n')) {
    if (line.startsWith('## ')) {
      currentSection = line.slice(3).trim().toLowerCase();
      sections[currentSection] = [];
    } else if (currentSection) {
      sections[currentSection].push(line);
    }
  }

  const metadata = {};
  for (const line of sections.metadata || []) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      metadata[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim();
    }
  }

  const gridLines = (sections.grid || []).filter(l => l.trim());
  const height = gridLines.length;
  const width = height > 0 ? gridLines[0].length : 0;

  const acrossClues = [];
  const downClues = [];
  for (const line of sections.clues || []) {
    const match = line.match(/^([AD])(\d+)\.\s*(.+?)\s*~\s*(.+)$/);
    if (match) {
      const clue = {
        number: parseInt(match[2]),
        direction: match[1] === 'A' ? 'across' : 'down',
        clue_text: match[3].trim(),
        answer: match[4].trim(),
      };
      if (match[1] === 'A') acrossClues.push(clue);
      else downClues.push(clue);
    }
  }

  return normalizePuzzlePayload({
    date,
    formatted_date: getFormattedDate(date),
    title: metadata.title || '',
    author: metadata.author || '',
    editor: metadata.editor || '',
    day_of_week: getDayOfWeek(date),
    permalink: '',
    clues: [...acrossClues, ...downClues]
  });
}

export function createNewYorkerProvider() {
  return {
    slug: 'new-yorker',
    title: 'New Yorker Crossword',
    lookbackDays: 14,
    async fetchByDate(date, env) {
      const [y, m, d] = date.split('-');

      // STEP 1: Fetch the date page to get UUID
      const pageUrl = `https://www.newyorker.com/puzzles-and-games-dept/crossword/${y}/${m}/${d}`;
      const html = await fetchText(pageUrl);

      // STEP 2: Extract UUID from page
      const uuidMatch = html.match(/"id":"([0-9a-f-]{36})"/);
      if (!uuidMatch) throw notFound(`No New Yorker puzzle found for ${date}`);
      const uuid = uuidMatch[1];

      // STEP 3: Fetch puzzle data from Conde Nast API
      // Verified working from Cloudflare Workers (tested 2026-05-26)
      const apiUrl = `https://puzzles-games-api.gp-prod.conde.digital/api/v1/games/${uuid}`;
      const json = await fetchJson(apiUrl, {
        headers: {
          'Origin': 'https://www.newyorker.com',
          'Referer': 'https://www.newyorker.com/puzzles-and-games-dept/crossword',
        }
      });

      return parseXdFormat(json.data, date);
    }
  };
}

export function createNewYorkerMiniProvider() {
  return {
    slug: 'new-yorker-mini',
    title: 'New Yorker Mini Crossword',
    lookbackDays: 14,
    async fetchByDate(date, env) {
      const [y, m, d] = date.split('-');
      const pageUrl = `https://www.newyorker.com/puzzles-and-games-dept/mini-crossword/${y}/${m}/${d}`;
      const html = await fetchText(pageUrl);

      const uuidMatch = html.match(/"id":"([0-9a-f-]{36})"/);
      if (!uuidMatch) throw notFound(`No New Yorker Mini puzzle found for ${date}`);
      const uuid = uuidMatch[1];

      const apiUrl = `https://puzzles-games-api.gp-prod.conde.digital/api/v1/games/${uuid}`;
      const json = await fetchJson(apiUrl, {
        headers: {
          'Origin': 'https://www.newyorker.com',
          'Referer': 'https://www.newyorker.com/puzzles-and-games-dept/mini-crossword',
        }
      });

      return parseXdFormat(json.data, date);
    }
  };
}
