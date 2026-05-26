import {
  fetchJson,
  getDayOfWeek,
  getFormattedDate,
  normalizePuzzlePayload,
  notFound
} from '../core/utils.js';

const AMUNIVERSAL_TOKEN = 'U2FsdGVkX18YuMv20%2B8cekf85%2Friz1H%2FzlWW4bn0cizt8yclLsp7UYv34S77X0aX%0Axa513fPTc5RoN2wa0h4ED9QWuBURjkqWgHEZey0WFL8%3D';

/**
 * Parse AmUniversal clue format: "number|clue_text\nnumber|clue_text\n..."
 * Each clue is on its own line, with number and text separated by a pipe.
 */
function parsePipeClues(pipeStr, direction) {
  if (!pipeStr) return [];
  const clues = [];
  const lines = pipeStr.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const pipeIdx = trimmed.indexOf('|');
    if (pipeIdx === -1) continue;
    const numStr = trimmed.slice(0, pipeIdx).trim();
    const clueText = trimmed.slice(pipeIdx + 1).trim();
    const number = parseInt(numStr, 10);
    if (isNaN(number) || !clueText) continue;
    clues.push({
      number,
      direction,
      clue_text: clueText,
      answer: '',
    });
  }
  return clues;
}

/**
 * Extract answers from AmUniversal Solution data.
 * Solution lines contain the actual letter rows, with spaces for black cells.
 * Cell numbers are assigned by standard crossword numbering rules.
 * Returns { [number]: { across: string, down: string } }
 */
function extractAnswersFromSolution(json) {
  const solution = json.Solution;
  if (!solution) return {};

  // Build the letter grid from Solution (spaces = black cells)
  const grid = [];
  for (let i = 1; ; i++) {
    const line = solution['Line' + i];
    if (!line) break;
    grid.push(line.split(''));
  }

  const height = grid.length;
  const width = height > 0 ? grid[0].length : 0;
  const isBlack = (r, c) => r < 0 || r >= height || c < 0 || c >= width || grid[r][c] === ' ';

  // Assign cell numbers using standard crossword rules
  const numbers = new Map();
  let nextNum = 1;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (isBlack(r, c)) continue;
      const startsAcross = (c === 0 || isBlack(r, c - 1)) && c + 1 < width && !isBlack(r, c + 1);
      const startsDown = (r === 0 || isBlack(r - 1, c)) && r + 1 < height && !isBlack(r + 1, c);
      if (startsAcross || startsDown) {
        numbers.set(`${r}:${c}`, nextNum);
        nextNum++;
      }
    }
  }

  // Extract across answers
  const answersByNumber = {};
  for (let r = 0; r < height; r++) {
    let c = 0;
    while (c < width) {
      if (isBlack(r, c)) { c++; continue; }
      const num = numbers.get(`${r}:${c}`);
      let answer = '';
      while (c < width && !isBlack(r, c)) {
        answer += grid[r][c];
        c++;
      }
      if (num !== undefined && answer.length > 1) {
        if (!answersByNumber[num]) answersByNumber[num] = {};
        answersByNumber[num].across = answer;
      }
    }
  }

  // Extract down answers
  for (let c = 0; c < width; c++) {
    let r = 0;
    while (r < height) {
      if (isBlack(r, c)) { r++; continue; }
      const num = numbers.get(`${r}:${c}`);
      let answer = '';
      while (r < height && !isBlack(r, c)) {
        answer += grid[r][c];
        r++;
      }
      if (num !== undefined && answer.length > 1) {
        if (!answersByNumber[num]) answersByNumber[num] = {};
        answersByNumber[num].down = answer;
      }
    }
  }

  return answersByNumber;
}

export function createUniversalProvider() {
  return {
    slug: 'universal',
    title: 'Universal Crossword',
    lookbackDays: 14,
    async fetchByDate(date, env) {
      const url = `https://gamedata.services.amuniversal.com/c/uucom/l/${AMUNIVERSAL_TOKEN}/g/fcx/d/${date}/data.json`;
      const json = await fetchJson(url);
      if (!json.AllAnswer) throw notFound(`No Universal puzzle for ${date}`);

      const answersByNumber = extractAnswersFromSolution(json);
      const acrossClues = parsePipeClues(json.AcrossClue, 'across');
      const downClues = parsePipeClues(json.DownClue, 'down');

      // Fill in answers from the Solution/Layout data
      for (const clue of [...acrossClues, ...downClues]) {
        const entry = answersByNumber[clue.number];
        if (entry) {
          clue.answer = entry[clue.direction] || '';
        }
      }

      return normalizePuzzlePayload({
        date,
        formatted_date: getFormattedDate(date),
        title: json.Title || '',
        author: json.Author || '',
        editor: json.Editor || '',
        day_of_week: getDayOfWeek(date),
        permalink: url,
        clues: [...acrossClues, ...downClues]
      });
    }
  };
}
