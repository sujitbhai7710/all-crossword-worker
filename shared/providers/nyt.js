import {
  fetchJson,
  getDayOfWeek,
  getFormattedDate,
  normalizePuzzlePayload,
  notFound
} from '../core/utils.js';

function parseNytPuzzle(json, date) {
  if (!json || !json.body || !json.body[0]) {
    throw notFound(`No NYT puzzle found for ${date}`);
  }

  const puzzleBody = json.body[0];
  const cells = puzzleBody.cells;

  const clues = [];
  if (puzzleBody.clues) {
    for (const rawClue of puzzleBody.clues) {
      let answer = '';
      if (rawClue.cells && Array.isArray(rawClue.cells)) {
        answer = rawClue.cells
          .map((cellIndex) => (cells[cellIndex] ? cells[cellIndex].answer : ''))
          .join('');
      }

      const number = parseInt(rawClue.label, 10);

      let clueText = '';
      if (rawClue.text && rawClue.text[0]) {
        if (rawClue.text[0].plain) {
          clueText = rawClue.text[0].plain;
        } else if (typeof rawClue.text[0] === 'string') {
          clueText = rawClue.text[0];
        }
      }

      if (clueText && number) {
        clues.push({
          number,
          direction: rawClue.direction.toLowerCase(),
          clue_text: clueText,
          answer
        });
      }
    }
  }

  return normalizePuzzlePayload({
    date,
    formatted_date: getFormattedDate(date),
    title: json.title || puzzleBody.title || '',
    author: (json.constructors && json.constructors[0]) ? json.constructors[0] :
            (puzzleBody.constructors && puzzleBody.constructors[0]) ? puzzleBody.constructors[0] : '',
    editor: json.editor || puzzleBody.editor || '',
    day_of_week: getDayOfWeek(date),
    permalink: '',
    clues
  });
}

export function createNytMidiProvider() {
  return {
    slug: 'nyt-midi',
    title: 'NYT Midi Crossword',
    lookbackDays: 14,
    async fetchByDate(date, env) {
      const url = `https://www.nytimes.com/svc/crosswords/v6/puzzle/midi/${date}.json`;
      const json = await fetchJson(url, {
        headers: { 'x-games-auth-bypass': 'true' }
      });
      return parseNytPuzzle(json, date);
    }
  };
}
