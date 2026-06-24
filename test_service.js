import { getAllCompetitorRates } from './backend/services/competitors.service.js';

async function test() {
  console.log("Starting scrape...");
  const rates = await getAllCompetitorRates('CAD', 'INR');
  console.log(rates);
}

test();
