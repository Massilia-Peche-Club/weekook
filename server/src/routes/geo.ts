import { Router, Request, Response, NextFunction } from 'express';
import { suggestCities, suggestAddresses } from '../lib/geo.js';

const router = Router();

// GET /cities?q= - Autocomplétion des communes (nom ou code postal) — formulaires kooker
router.get('/cities', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = String(req.query.q || '').slice(0, 100);
    res.json({ success: true, data: await suggestCities(q) });
  } catch (error) {
    next(error);
  }
});

// GET /addresses?q= - Autocomplétion d'adresses — lieu de la prestation (recherche)
router.get('/addresses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = String(req.query.q || '').slice(0, 200);
    res.json({ success: true, data: await suggestAddresses(q) });
  } catch (error) {
    next(error);
  }
});

export default router;
