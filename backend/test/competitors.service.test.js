import assert from 'node:assert/strict';
import { getAllCompetitorRates } from '../services/competitors.service.js';

const rates = await getAllCompetitorRates('CAD', 'INR');
const expectedNames = ['RemitBee', 'Wise', 'XE', 'Ria', 'WesternUnion', 'TransferGo', 'Instarem', 'OFX', 'LemFi', 'Remitly', 'TapTap Send'];

for (const name of expectedNames) {
  assert.ok(rates[name], `${name} should be present in competitor rates`);
}

console.log('Competitor service test passed for', Object.keys(rates).join(', '));
