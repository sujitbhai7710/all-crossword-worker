const fs = require('fs');
const https = require('https');
const path = require('path');

// 1. Parse Command Line Arguments
const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Please provide a date in YYYY-MM-DD format.');
    process.exit(1);
}
const dateStr = args[0]; // Expected format: YYYY-MM-DD

// Regex to validate date format could be added here
const dateParts = dateStr.split('-');
if (dateParts.length !== 3) {
    console.error('Invalid date format. Use YYYY-MM-DD.');
    process.exit(1);
}

// 1.5 Optional Local File Override (for testing or if API is blocked)
const localOverride = args[1]; // Optional second argument

if (localOverride) {
    console.log(`Using local file: ${localOverride}`);
    if (fs.existsSync(localOverride)) {
        try {
            const fileData = fs.readFileSync(localOverride, 'utf8');
            const parsedData = JSON.parse(fileData);
            processAndSave(parsedData, dateStr);
        } catch (e) {
            console.error(`Error reading local file: ${e.message}`);
        }
    } else {
        console.error(`Local file not found: ${localOverride}`);
    }
    return; // Skip fetching
}

const url = `https://www.nytimes.com/svc/crosswords/v6/puzzle/daily/${dateStr}.json`;

console.log(`Fetching crossword for ${dateStr}...`);

const options = {
    headers: {
        'authority': 'www.nytimes.com',
        'method': 'GET',
        'path': `/svc/crosswords/v6/puzzle/daily/${dateStr}.json`,
        'scheme': 'https',
        'accept': '*/*',
        // 'accept-encoding': 'gzip, deflate, br, zstd', // Removed to receive plain text
        'accept-language': 'en-US,en;q=0.7',
        'content-type': 'application/x-www-form-urlencoded',
        'priority': 'u=1, i',
        'referer': `https://www.nytimes.com/crosswords/game/daily/${dateStr.replace(/-/g, '/')}`,
        'sec-ch-ua': '"Brave";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'sec-gpc': '1',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
        'x-games-auth-bypass': 'true'
    }
};

https.get(url, options, (res) => {
    if (res.statusCode !== 200) {
        console.error(`Failed to fetch data. Status Code: ${res.statusCode}`);
        if (res.statusCode === 403) {
            console.error('Access denied. You may need valid cookies or NYT subscription for this date.');
        }
        res.resume();
        return;
    }

    let rawData = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        if (!rawData) {
            console.error('Error: Received empty response body.');
            return;
        }
        try {
            const parsedData = JSON.parse(rawData);
            processAndSave(parsedData, dateStr);
        } catch (e) {
            console.error(`JSON Parse Error: ${e.message}`);
            console.error('Raw Data Preview:', rawData.substring(0, 200));
        }
    });
}).on('error', (e) => {
    console.error(`Got error: ${e.message}`);
});

function processAndSave(sourceData, dateStr) {
    if (!sourceData.body || !sourceData.body[0]) {
        console.error('Invalid JSON structure: missing body');
        return;
    }

    const puzzleBody = sourceData.body[0];
    const cells = puzzleBody.cells; // Array of { answer: "X", ... }

    // -- 1. Construct Puzzle Metadata --
    // Use data from source root
    const puzzleInfo = {
        puzzle_id: sourceData.id,
        date: sourceData.publicationDate,
        formatted_date: new Date(sourceData.publicationDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        title: sourceData.title || `New York Times, ${new Date(sourceData.publicationDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`,
        author: sourceData.constructors ? sourceData.constructors.join(', ') : '',
        editor: sourceData.editor || '',
        day_of_week: new Date(sourceData.publicationDate).toLocaleDateString('en-US', { weekday: 'long' }),
        created_at: new Date().toISOString().replace('T', ' ').split('.')[0] // Current time in roughly similar format
    };

    // -- 2. Process Clues and Answers --
    const transformedClues = [];

    if (puzzleBody.clues) {
        puzzleBody.clues.forEach((rawClue, index) => {
            // rawClue has: direction, label, text (array), cells (array of indices)

            // Reconstruct Answer
            let answer = "";
            if (rawClue.cells && Array.isArray(rawClue.cells)) {
                answer = rawClue.cells.map(cellIndex => {
                    const cell = cells[cellIndex];
                    return cell ? cell.answer : "";
                }).join("");
            }

            // Extract Clue Text
            // rawClue.text is typically [{ plain: "..." }]
            let clueText = "";
            if (rawClue.text && rawClue.text.length > 0 && rawClue.text[0].plain) {
                clueText = rawClue.text[0].plain;
            } else {
                // Fallback or handle different format if needed
                clueText = JSON.stringify(rawClue.text);
            }

            const direction = rawClue.direction.toLowerCase();
            const number = parseInt(rawClue.label, 10);

            // Generate a deterministic clue_id
            // Using a simple combination or just a large number base
            const clueId = parseInt(`${sourceData.id}${index}`, 10);

            transformedClues.push({
                clue_id: clueId, // You might want a better unique ID strategy
                puzzle_id: puzzleInfo.puzzle_id,
                number: number,
                direction: direction,
                clue_text: clueText,
                answer: answer
            });
        });
    }

    // Split into Across and Down
    const across = transformedClues.filter(c => c.direction === 'across');
    const down = transformedClues.filter(c => c.direction === 'down');

    // -- 3. Final Object Structure --
    const finalOutput = {
        success: true,
        data: {
            puzzle: puzzleInfo,
            clues: transformedClues,
            across: across,  // Note: The example had separate across/down arrays with same objects
            down: down
        }
    };

    // -- 4. Save to File --
    const saveDir = path.join(__dirname, 'saved');
    if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir);
    }

    const filePath = path.join(saveDir, `${dateStr}.json`);
    fs.writeFileSync(filePath, JSON.stringify(finalOutput, null, 4), 'utf8');

    console.log(`Successfully saved to ${filePath}`);
}
