import {
  cleanClueText,
  decodeHtmlEntities,
  fetchText,
  normalizePuzzlePayload,
  notFound
} from './utils.js';

function reverseSegments(rawc, key) {
  const buffer = rawc.split('');
  let index = 0;
  let segment = 0;

  while (index < buffer.length - 1) {
    const length = Math.min(key[segment % key.length], buffer.length - index);
    segment += 1;

    let left = index;
    let right = index + length - 1;
    while (left < right) {
      const temp = buffer[left];
      buffer[left] = buffer[right];
      buffer[right] = temp;
      left += 1;
      right -= 1;
    }

    index += length;
  }

  return buffer.join('');
}

function decodeBase64Bytes(base64Text) {
  const binary = atob(base64Text);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeRawcWithKey(rawc, key) {
  try {
    const bytes = decodeBase64Bytes(reverseSegments(rawc, key));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

function isValidKeyPrefix(rawc, keyPrefix, spacing) {
  try {
    let position = 0;
    let chunk = [];

    while (position < rawc.length) {
      const start = position;
      let keyIndex = 0;

      while (keyIndex < keyPrefix.length && position < rawc.length) {
        const length = Math.min(keyPrefix[keyIndex], rawc.length - position);
        chunk.push(rawc.slice(position, position + length).split('').reverse().join(''));
        position += length;
        keyIndex += 1;
      }

      const chunkText = chunk.join('');
      const base64Start = Math.ceil(start / 4) * 4 - start;
      const base64End = Math.floor(position / 4) * 4 - start;

      if (base64Start >= chunkText.length || base64End <= base64Start) {
        chunk = [];
        position += spacing;
        continue;
      }

      const base64Chunk = chunkText.slice(base64Start, base64End);

      try {
        const bytes = decodeBase64Bytes(base64Chunk);
        for (const byte of bytes) {
          if ((byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) || byte === 0xc0 || byte === 0xc1 || byte >= 0xf5) {
            return false;
          }
        }
      } catch {
        return false;
      }

      chunk = [];
      position += spacing;
    }

    return true;
  } catch {
    return false;
  }
}

export function deobfuscateRawc(rawc) {
  const yePos = rawc.indexOf('ye');
  const wePos = rawc.indexOf('we');
  const firstDigit = Math.min(yePos === -1 ? rawc.length : yePos, wePos === -1 ? rawc.length : wePos) + 2;
  const queue = firstDigit > 20 ? [[]] : [[firstDigit]];

  while (queue.length > 0) {
    const key = queue.shift();

    if (key.length === 7) {
      const decoded = decodeRawcWithKey(rawc, key);
      try {
        JSON.parse(decoded);
        return decoded;
      } catch {
        continue;
      }
    }

    for (let next = 2; next <= 20; next += 1) {
      const candidate = [...key, next];
      const remaining = 7 - candidate.length;
      const minSpacing = 2 * remaining;
      const maxSpacing = 20 * remaining;
      let valid = false;

      for (let spacing = minSpacing; spacing <= maxSpacing; spacing += 1) {
        if (isValidKeyPrefix(rawc, candidate, spacing)) {
          valid = true;
          break;
        }
      }

      if (valid) {
        queue.push(candidate);
      }
    }
  }

  throw new Error('Unable to decode rawc payload.');
}

function parseAmusePuzzle(xwordData, puzzleDate, defaults = {}) {
  const width = xwordData.w;
  const height = xwordData.h;
  const box = xwordData.box;
  const grid = [];

  for (let row = 0; row < height; row += 1) {
    grid[row] = [];
    for (let col = 0; col < width; col += 1) {
      const value = box[col]?.[row];
      grid[row][col] = value === '\u0000' ? '.' : value || 'X';
    }
  }

  const isBlack = (row, col) => grid[row][col] === '.';
  const numbers = new Map();
  let nextNumber = 1;

  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      if (isBlack(row, col)) {
        continue;
      }

      const startsAcross = (col === 0 || isBlack(row, col - 1)) && col + 1 < width && !isBlack(row, col + 1);
      const startsDown = (row === 0 || isBlack(row - 1, col)) && row + 1 < height && !isBlack(row + 1, col);

      if (startsAcross || startsDown) {
        numbers.set(`${row}:${col}`, nextNumber);
        nextNumber += 1;
      }
    }
  }

  const orderedWords = [...(xwordData.placedWords || [])].sort((a, b) => {
    if (a.y !== b.y) {
      return a.y - b.y;
    }
    if (a.x !== b.x) {
      return a.x - b.x;
    }
    return a.acrossNotDown === b.acrossNotDown ? 0 : a.acrossNotDown ? -1 : 1;
  });

  const clues = orderedWords
    .map((word) => ({
      number: Number.parseInt(word.clueNum, 10) || numbers.get(`${word.y}:${word.x}`),
      direction: word.acrossNotDown ? 'across' : 'down',
      clue_text: cleanClueText(word.clue?.clue || ''),
      answer: decodeHtmlEntities(String(word.word || word.originalTerm || word.nospaceStr || '')).replace(/\s+/g, '').trim()
    }))
    .filter((clue) => clue.number && clue.clue_text && clue.answer);

  return normalizePuzzlePayload({
    date: puzzleDate,
    formatted_date: defaults.formatted_date,
    day_of_week: defaults.day_of_week,
    title: xwordData.title || defaults.title || '',
    author: xwordData.author || defaults.author || '',
    editor: xwordData.editor || defaults.editor || '',
    permalink: defaults.permalink || '',
    clues
  });
}

export async function fetchAmuseLabsPuzzle({ url, date, defaults }) {
  const html = await fetchText(url);

  if (html.includes('The puzzle you are trying to access was not found')) {
    throw notFound(`No puzzle found at ${url}`);
  }

  let rawc = '';
  const paramsMatch = html.match(/<script[^>]*id="params"[^>]*>([\s\S]*?)<\/script>/i);
  if (paramsMatch) {
    const params = JSON.parse(paramsMatch[1]);
    rawc = params.rawc || '';
  }

  if (!rawc) {
    const rawcMatch = html.match(/window\.(?:puzzleEnv\.)?rawc\s*=\s*'([^']+)'/);
    rawc = rawcMatch ? rawcMatch[1] : '';
  }

  if (!rawc) {
    throw new Error('AmuseLabs page did not contain a rawc payload.');
  }

  const decoded = deobfuscateRawc(rawc);
  const json = JSON.parse(decoded);
  return parseAmusePuzzle(json, date, defaults);
}
