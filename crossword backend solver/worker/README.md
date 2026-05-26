# Crossword Solver API

A Cloudflare Worker that scrapes crossword puzzle answers from crosswordnexus.com to help solve crossword puzzles.

## Features

- Scrapes crossword answers from crosswordnexus.com
- Supports pattern matching (e.g., "a?s" for words like "aws", "abs", etc.)
- Returns answers with their rating (1-4 stars)
- CORS enabled for use in web applications

## API Usage

### Get Answers for a Clue

```
GET /?clue=what+cuteness+tends+to+evoke
```

### Get Answers for a Clue with Pattern

```
GET /?clue=what+cuteness+tends+to+evoke&pattern=a?s
```

### Response Format

```json
{
  "success": true,
  "answers": [
    {
      "word": "AWS",
      "rating": 4
    },
    {
      "word": "ABS",
      "rating": 1
    },
    ...
  ],
  "source": "crosswordnexus.com"
}
```

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or later)
- [Wrangler CLI](https://developers.cloudflare.com/workers/cli-wrangler/install-update)

### Setup

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

### Deployment

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

## Integration with Next.js App

To integrate this API with the Next.js crossword solver app:

1. Deploy the worker to Cloudflare
2. Update the Next.js app to use the API endpoint for fetching crossword answers

## License

MIT 