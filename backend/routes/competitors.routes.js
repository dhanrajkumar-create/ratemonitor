import express from 'express';
import { getCompetitors } from '../controllers/competitors.controller.js';

const router = express.Router();

router.get('/', getCompetitors);

export default router;
