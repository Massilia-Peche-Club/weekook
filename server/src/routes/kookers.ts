import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { authenticate, requireKooker, invalidateAuthCache } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { becomeKookerSchema, updateKookerProfileSchema } from '../schemas/kooker.js';
import { AppError, NotFoundError } from '../utils/errors.js';

const router = Router();

// GET / - Search kookers with filters
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      q,
      type,
      specialty,
      city,
      minPrice,
      maxPrice,
      difficulty,
      page = '1',
      limit = '12',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.KookerProfileWhereInput = { active: true };

    // When no text search: apply city filter at DB level for performance
    if (city && !q) {
      where.city = { contains: city as string };
    }

    // When q is set, fetch all active kookers and filter in JS
    // (required to search JSON fields: specialties, type)
    const hasTextSearch = !!q;

    const [kookers, dbTotal] = await Promise.all([
      prisma.kookerProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          services: {
            where: { active: true },
            select: {
              id: true,
              priceInCents: true,
              type: true,
              title: true,
              description: true,
              specialty: true,
              koursDifficulty: true,
              images: {
                orderBy: [{ isCardImage: 'desc' }, { sortOrder: 'asc' }],
                select: { url: true, isCardImage: true },
                take: 1,
              },
            },
          },
        },
        skip: hasTextSearch ? undefined : skip,
        take: hasTextSearch ? undefined : limitNum,
        orderBy: [{ featured: 'desc' }, { rating: 'desc' }],
      }),
      prisma.kookerProfile.count({ where }),
    ]);

    let filtered = kookers;

    // Full-text JS filter: name, bio, city, address, specialties (JSON), type (JSON)
    if (q) {
      const searchLower = (q as string).toLowerCase();
      filtered = filtered.filter((k) => {
        const fullName = `${k.user.firstName} ${k.user.lastName}`.toLowerCase();
        const bio = (k.bio || '').toLowerCase();
        const kCity = (k.city || '').toLowerCase();
        const address = (k.address || '').toLowerCase();
        const specialtiesStr = JSON.stringify(k.specialties || []).toLowerCase();
        const typeStr = JSON.stringify(k.type || []).toLowerCase();
        const servicesStr = k.services.map((s: any) =>
          `${s.title || ''} ${s.description || ''} ${JSON.stringify(s.specialty || [])}`
        ).join(' ').toLowerCase();
        return (
          fullName.includes(searchLower) ||
          bio.includes(searchLower) ||
          kCity.includes(searchLower) ||
          address.includes(searchLower) ||
          specialtiesStr.includes(searchLower) ||
          typeStr.includes(searchLower) ||
          servicesStr.includes(searchLower)
        );
      });
    }

    // Post-filter by type — se base uniquement sur les types des services actifs
    // (le profil kooker peut avoir un type déclaré qui ne correspond pas aux services réels)
    if (type) {
      const typeFilter = type as string;
      const parseTypes = (val: any): string[] => {
        if (Array.isArray(val)) return val;
        try { const p = JSON.parse(val || '[]'); return Array.isArray(p) ? p : JSON.parse(p); } catch { return []; }
      };
      filtered = filtered.filter((k) =>
        k.services.some((s: any) => parseTypes(s.type).includes(typeFilter))
      );
    }

    // Post-filter by specialty (JSON field — may be stored as string or parsed array)
    if (specialty) {
      const specialtyFilter = specialty as string;
      filtered = filtered.filter((k) => {
        const kSpec: string[] = Array.isArray(k.specialties)
          ? (k.specialties as string[])
          : JSON.parse((k.specialties as string) || '[]');
        return kSpec.includes(specialtyFilter);
      });
    }

    // Post-filter by city (when text search is active)
    if (city && hasTextSearch) {
      const cityLower = (city as string).toLowerCase();
      filtered = filtered.filter((k) => (k.city || '').toLowerCase().includes(cityLower));
    }

    // Post-filter by price
    if (minPrice || maxPrice) {
      const min = minPrice ? parseInt(minPrice as string, 10) * 100 : 0;
      const max = maxPrice ? parseInt(maxPrice as string, 10) * 100 : Infinity;
      filtered = filtered.filter((k) => {
        if (k.services.length === 0) return false;
        const lowestPrice = Math.min(...k.services.map((s) => s.priceInCents));
        return lowestPrice >= min && lowestPrice <= max;
      });
    }

    // Post-filter by kours difficulty
    if (difficulty) {
      const difficultyFilter = difficulty as string;
      filtered = filtered.filter((k) => {
        return k.services.some((s: any) => {
          const sTypes = Array.isArray(s.type) ? s.type : JSON.parse(s.type || '[]');
          return sTypes.includes('COURS') && s.koursDifficulty === difficultyFilter;
        });
      });
    }

    // Paginate filtered results (only needed when text search fetched all)
    const total = hasTextSearch ? filtered.length : dbTotal;
    const paginatedKookers = hasTextSearch ? filtered.slice(skip, skip + limitNum) : filtered;

    res.json({
      success: true,
      data: {
        kookers: paginatedKookers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /dashboard/stats - Kooker dashboard statistics (must be before /:id)
router.get(
  '/dashboard/stats',
  authenticate,
  requireKooker,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const kookerProfileId = req.user!.kookerProfileId!;

      const [totalBookings, pendingBookings, revenueResult, kookerProfile] = await Promise.all([
        prisma.booking.count({
          where: { kookerProfileId },
        }),
        prisma.booking.count({
          where: { kookerProfileId, status: 'pending' },
        }),
        prisma.booking.aggregate({
          where: { kookerProfileId, status: 'completed' },
          _sum: { totalPriceInCents: true },
        }),
        prisma.kookerProfile.findUnique({
          where: { id: kookerProfileId },
          select: { rating: true, reviewCount: true },
        }),
      ]);

      res.json({
        success: true,
        data: {
          totalBookings,
          pendingBookings,
          totalRevenue: revenueResult._sum.totalPriceInCents || 0,
          avgRating: kookerProfile?.rating || 0,
          totalReviews: kookerProfile?.reviewCount || 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /:id - Full kooker profile
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('ID invalide', 400);
    }

    const kooker = await prisma.kookerProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            createdAt: true,
          },
        },
        services: {
          where: { active: true },
          include: {
            images: { orderBy: { sortOrder: 'asc' } },
            menuItems: { orderBy: { sortOrder: 'asc' } },
          },
        },
        reviewsReceived: {
          where: { type: 'user_to_kooker', status: 'approved' },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
            booking: {
              select: {
                service: { select: { title: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        availabilities: {
          where: {
            date: { gte: new Date() },
          },
          orderBy: { date: 'asc' },
        },
        bookingsReceived: {
          where: {
            status: { in: ['pending', 'confirmed', 'completed'] },
            date: { gte: new Date() },
          },
          select: { date: true, startTime: true, status: true },
        },
      },
    });

    if (!kooker || !kooker.active) {
      throw new NotFoundError('Profil kooker non trouve');
    }

    const { bookingsReceived, stripeAccountId, stripeOnboardingComplete, address, userId: _uid, ...kookerData } = kooker as any;
    const confirmedSlots = (bookingsReceived || []).map((b: any) => {
      const rawDate: Date = b.date;
      const dateStr = rawDate instanceof Date
        ? rawDate.toISOString().slice(0, 10)
        : String(rawDate).slice(0, 10);
      const startTime = String(b.startTime).slice(0, 5); // normalize to HH:MM
      return { date: dateStr, startTime, status: b.status };
    });

    res.json({
      success: true,
      data: { ...kookerData, confirmedSlots },
    });
  } catch (error) {
    next(error);
  }
});

// POST /become - Become a kooker
router.post(
  '/become',
  authenticate,
  validate(becomeKookerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;

      const existing = await prisma.kookerProfile.findUnique({
        where: { userId },
      });

      if (existing) {
        throw new AppError('Vous etes deja kooker', 409);
      }

      const { bio, specialties, type, city, experience, isCompany } = req.body;

      const kookerProfile = await prisma.kookerProfile.create({
        data: {
          userId,
          bio,
          specialties,
          type,
          city,
          experience,
          isCompany: isCompany ?? false,
          active: false,
        },
      });

      // Update user role
      await prisma.user.update({
        where: { id: userId },
        data: { role: 'kooker' },
      });

      // Invalidate auth cache so next request picks up new role + kookerProfileId
      invalidateAuthCache(userId);

      res.status(201).json({
        success: true,
        data: kookerProfile,
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /profile - Update kooker profile
router.put(
  '/profile',
  authenticate,
  requireKooker,
  validate(updateKookerProfileSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const kookerProfileId = req.user!.kookerProfileId!;
      const { bio, specialties, type, city, experience, address, isCompany } = req.body;

      const data: Record<string, unknown> = {};
      if (bio !== undefined) data.bio = bio;
      if (specialties !== undefined) data.specialties = specialties;
      if (type !== undefined) data.type = type;
      if (city !== undefined) data.city = city;
      if (experience !== undefined) data.experience = experience;
      if (address !== undefined) data.address = address;
      if (isCompany !== undefined) data.isCompany = isCompany;

      const updated = await prisma.kookerProfile.update({
        where: { id: kookerProfileId },
        data,
      });

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
