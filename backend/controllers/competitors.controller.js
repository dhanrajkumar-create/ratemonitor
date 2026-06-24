import { getAllCompetitorRates } from '../services/competitors.service.js';

// Simple in-memory cache
const cache = {
  data: {},
  timestamp: 0
};

export const getCompetitors = async (req, res) => {
  const from = req.query.from || 'CAD';
  const to = req.query.to || 'INR';
  const force = req.query.force === 'true';
  const cacheKey = `${from}_${to}`;

  // Serve from cache if less than 5 minutes old
  if (!force && cache.data[cacheKey] && Date.now() - cache.timestamp < 5 * 60 * 1000) {
    return res.json({ cached: true, data: cache.data[cacheKey] });
  }

  try {
    const rates = await getAllCompetitorRates(from, to);
    
    // Update cache
    cache.data[cacheKey] = rates;
    cache.timestamp = Date.now();
    
    res.json({ cached: false, data: rates });
  } catch (error) {
    console.error("Controller Error:", error);
    res.status(500).json({ error: "Failed to fetch competitor rates" });
  }
};
