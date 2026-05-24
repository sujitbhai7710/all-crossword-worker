import { fetchAmuseLabsPuzzle } from '../core/amuselabs.js';
import { getFormattedDate, getDayOfWeek } from '../core/utils.js';

export function createAtlanticProvider() {
  return {
    slug: 'atlantic',
    title: 'The Atlantic Crossword',
    lookbackDays: 21,
    async fetchByDate(date) {
      const compact = date.replace(/-/g, '');
      const url = `https://cdn3.amuselabs.com/atlantic/crossword?id=atlantic_${compact}&set=atlantic`;

      return fetchAmuseLabsPuzzle({
        url,
        date,
        defaults: {
          title: 'The Atlantic Crossword',
          formatted_date: getFormattedDate(date),
          day_of_week: getDayOfWeek(date),
          permalink: url
        }
      });
    }
  };
}
