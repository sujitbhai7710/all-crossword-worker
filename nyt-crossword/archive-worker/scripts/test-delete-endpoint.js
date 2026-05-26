#!/usr/bin/env node

/**
 * Test the delete endpoint for the crossword archive worker
 * 
 * Usage:
 * node ./scripts/test-delete-endpoint.js 2025-05-14
 */

const date = process.argv[2];
if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
  console.error('Please provide a date in YYYY-MM-DD format');
  console.error('Example: node test-delete-endpoint.js 2025-05-14');
  process.exit(1);
}

// Cloudflare worker URL
const BASE_URL = 'https://crossword-archive-worker.mitomat.workers.dev';
const deleteUrl = `${BASE_URL}/api/delete/${date}`;

// Make the API request
console.log(`Deleting puzzle for date: ${date}`);
console.log(`URL: ${deleteUrl}`);

fetch(deleteUrl)
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    console.log('Success:', data);
  })
  .catch(error => {
    console.error('Error:', error);
  }); 