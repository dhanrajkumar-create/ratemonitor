import { Router } from 'express';
import { getRates } from '../controllers/rates.controller.js';

const router = Router();

// GET /api/rates          → all providers, all currencies
// GET /api/rates?to=INR   → all providers for one destination currency
router.get('/', getRates);

export default router;
