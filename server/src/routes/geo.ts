import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { searchCities, reverseCity, geocodeAddress } from '../lib/geo.js';
import { AppError } from '../utils/errors.js';

const router = Router();

// GET /cities?q= - Autocomplétion des communes (nom ou code postal)
router.get('/cities', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = String(req.query.q || '').slice(0, 100);
    const places = await searchCities(q);
    res.json({ success: true, data: places });
  } catch (error) {
    next(error);
  }
});

// GET /reverse?lat=&lng= - Commune correspondant à une position GPS
router.get('/reverse', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lat = parseFloat(String(req.query.lat));
    const lng = parseFloat(String(req.query.lng));
    if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new AppError('Coordonnées invalides', 400);
    }
    const place = await reverseCity(lat, lng);
    res.json({ success: true, data: place });
  } catch (error) {
    next(error);
  }
});

// GET /home - Position de l'adresse « chez moi » du client (profil d'accueil)
router.get('/home', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await prisma.userProfile.findUnique({ where: { userId: req.user!.userId } });
    const parts = [profile?.address, profile?.postalCode, profile?.city].filter((p) => p && p.trim());
    if (parts.length === 0) {
      return res.json({ success: true, data: null });
    }
    const place = await geocodeAddress(parts.join(' '));
    res.json({ success: true, data: place ? { ...place, label: 'Chez moi' } : null });
  } catch (error) {
    next(error);
  }
});

export default router;
