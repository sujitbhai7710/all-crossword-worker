import {
  fetchText,
  getDayOfWeek,
  getFormattedDate,
  normalizePuzzlePayload,
  notFound
} from '../core/utils.js';

function parseCrosswordCompilerXml(xml, date) {
  const titleMatch = xml.match(/<title>([^<]+)<\/title>/i);
  const creatorMatch = xml.match(/<creator>([^<]+)<\/creator>/i);

  // Build a grid map from cell elements: "x,y" -> solution letter
  const gridMap = {};
  for (const m of xml.matchAll(/<cell\s+x="(\d+)"\s+y="(\d+)"\s+solution="([^"]+)"/gi)) {
    gridMap[`${m[1]},${m[2]}`] = m[3];
  }
  // Also handle reversed attribute order
  for (const m of xml.matchAll(/<cell\s+y="(\d+)"\s+x="(\d+)"\s+solution="([^"]+)"/gi)) {
    gridMap[`${m[2]},${m[1]}`] = m[3];
  }

  // Build a word map from <word> elements: id -> { x1, x2, y1, y2, direction }
  const wordMap = {};
  for (const m of xml.matchAll(/<word\s+id="(\d+)"\s+x="([^"]+)"\s+y="([^"]+)"[^/]*\/>/gi)) {
    const id = m[1];
    const xRange = m[2];
    const yRange = m[3];
    const isAcross = xRange.includes('-');
    let answer = '';
    if (isAcross) {
      const [x1, x2] = xRange.split('-').map(Number);
      const y = Number(yRange);
      for (let x = x1; x <= x2; x++) {
        answer += gridMap[`${x},${y}`] || '?';
      }
    } else {
      const x = Number(xRange);
      const [y1, y2] = yRange.split('-').map(Number);
      for (let y = y1; y <= y2; y++) {
        answer += gridMap[`${x},${y}`] || '?';
      }
    }
    wordMap[id] = { direction: isAcross ? 'across' : 'down', answer };
  }

  // Parse clue sections: <clues> contains <title><b>Across</b></title> or <b>Down</b></title>
  // followed by <clue word="N" number="N">clue text</clue>
  const clues = [];
  const clueSections = [...xml.matchAll(/<clues[^>]*>([\s\S]*?)<\/clues>/gi)];

  for (const section of clueSections) {
    const content = section[1];
    // Determine direction from the title
    const isDown = /<b>Down<\/b>/i.test(content);
    const direction = isDown ? 'down' : 'across';

    // Extract individual clues
    for (const cm of content.matchAll(/<clue\s+word="(\d+)"\s+number="(\d+)"[^>]*>([^<]+)<\/clue>/gi)) {
      const wordId = cm[1];
      const number = parseInt(cm[2], 10);
      const clueText = cm[3].trim();
      const wordInfo = wordMap[wordId];
      const answer = wordInfo?.answer || '';

      if (clueText) {
        clues.push({ number, direction, clue_text: clueText, answer });
      }
    }
  }

  return normalizePuzzlePayload({
    date,
    formatted_date: getFormattedDate(date),
    title: titleMatch ? titleMatch[1] : 'Daily Pop Crossword',
    author: creatorMatch ? creatorMatch[1].replace(/^by\s+/i, '') : '',
    editor: '',
    day_of_week: getDayOfWeek(date),
    permalink: '',
    clues
  });
}

export function createDailyPopProvider() {
  return {
    slug: 'daily-pop',
    title: 'Daily Pop Crossword',
    lookbackDays: 14,
    async fetchByDate(date, env) {
      const compact = date.slice(2, 4) + date.slice(5, 7) + date.slice(8, 10);

      // Step 1: Get API key from setup JS
      const jsUrl = 'http://dailypopcrosswordsweb.puzzlenation.com/crosswordSetup.js';
      const jsText = await fetchText(jsUrl);
      const keyMatch = jsText.match(/API_KEY\s*=\s*["']([^"']+)["']/);
      if (!keyMatch) throw notFound('Could not extract Daily Pop API key');
      const apiKey = keyMatch[1];

      // Step 2: Fetch puzzle XML
      const url = `https://api.puzzlenation.com/dailyPopCrosswords/puzzles/daily/${compact}`;
      const xml = await fetchText(url, {
        headers: { 'x-api-key': apiKey }
      });

      if (!xml || xml.length < 100) {
        throw notFound(`No Daily Pop puzzle for ${date}`);
      }

      return parseCrosswordCompilerXml(xml, date);
    }
  };
}
