import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { NotFoundError } from '../utils/errors.js';
import fs from 'fs';
import path from 'path';

const router = Router();

// ── Public: taux de commission (accessible sans auth pour les formulaires) ─────
router.get('/config/public', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const keys = ['commissionKours', 'commissionKook', 'specialties', 'kookBaseGuests', 'units', 'tooltipFruitsDesMer', 'tooltipCommission', 'ingredientsChoiceEnabled', 'ingredientsChoiceDefault'];
    const configs = await prisma.config.findMany({ where: { key: { in: keys } } });
    const result: Record<string, unknown> = {
      commissionKours: 20,
      commissionKook: 20,
      specialties: [],
      kookBaseGuests: 6,
      units: [],
      tooltipFruitsDesMer: "produits de la mer à l'exception des poissons",
      tooltipCommission: "La commission Weekook est prélevée sur chaque réservation. Elle couvre les frais de la plateforme, le paiement sécurisé et l'assistance client.",
      ingredientsChoiceEnabled: true,
      ingredientsChoiceDefault: 'client',
    };
    for (const c of configs) {
      try { result[c.key] = JSON.parse(c.value); } catch { /* ignore */ }
    }
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// All admin routes below require authentication + admin role
router.use(authenticate, requireAdmin);

// ── Stats ─────────────────────────────────────────────────────────────────────

// GET /stats
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [userCount, kookerCount, bookingCount, revenueAgg] = await Promise.all([
      prisma.user.count(),
      prisma.kookerProfile.count(),
      prisma.booking.count(),
      prisma.booking.aggregate({
        _sum: { totalPriceInCents: true },
        where: { status: { in: ['confirmed', 'completed'] } },
      }),
    ]);

    res.json({
      success: true,
      data: {
        userCount,
        kookerCount,
        bookingCount,
        revenueInCents: revenueAgg._sum.totalPriceInCents ?? 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── Users ─────────────────────────────────────────────────────────────────────

// GET /users
router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, role, page = '1', limit = '20' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatar: true,
          role: true,
          isAdmin: true,
          createdAt: true,
          kookerProfile: { select: { id: true, active: true, verified: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ success: true, data: { users, total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    next(error);
  }
});

// PUT /users/:id
router.put('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const { role, suspended, isAdmin } = req.body;

    const data: any = {};
    if (role !== undefined) data.role = role;
    if (suspended !== undefined) data.role = suspended ? 'suspended' : 'user';
    if (isAdmin !== undefined) data.isAdmin = Boolean(isAdmin);

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isAdmin: true },
    });

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

// DELETE /users/:id
router.delete('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.user.delete({ where: { id } });
    res.json({ success: true, data: { message: 'Utilisateur supprimé' } });
  } catch (error) {
    next(error);
  }
});

// ── Kookers ───────────────────────────────────────────────────────────────────

// GET /kookers
router.get('/kookers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, page = '1', limit = '20' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = {};
    if (search) {
      where.OR = [
        { city: { contains: search } },
        { user: { email: { contains: search } } },
        { user: { firstName: { contains: search } } },
        { user: { lastName: { contains: search } } },
      ];
    }

    const [kookers, total] = await Promise.all([
      prisma.kookerProfile.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
          _count: { select: { services: true, bookingsReceived: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.kookerProfile.count({ where }),
    ]);

    res.json({ success: true, data: { kookers, total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    next(error);
  }
});

// PUT /kookers/:id
router.put('/kookers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const { featured, verified, active } = req.body;

    const data: any = {};
    if (featured !== undefined) data.featured = featured;
    if (verified !== undefined) data.verified = verified;
    if (active !== undefined) data.active = active;

    const kooker = await prisma.kookerProfile.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    res.json({ success: true, data: kooker });
  } catch (error) {
    next(error);
  }
});

// ── Reviews ───────────────────────────────────────────────────────────────────

// GET /reviews/kooker/:id
router.get('/reviews/kooker/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const kookerProfileId = parseInt(req.params.id);
    const reviews = await prisma.review.findMany({
      where: { kookerProfileId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: reviews });
  } catch (error) {
    next(error);
  }
});

// DELETE /reviews/:id
router.delete('/reviews/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundError('Avis introuvable');

    await prisma.review.delete({ where: { id } });

    // Recalculate kooker rating
    const agg = await prisma.review.aggregate({
      where: { kookerProfileId: review.kookerProfileId },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await prisma.kookerProfile.update({
      where: { id: review.kookerProfileId },
      data: {
        rating: Math.round((agg._avg.rating || 0) * 10) / 10,
        reviewCount: agg._count.rating,
      },
    });

    res.json({ success: true, data: { message: 'Avis supprimé' } });
  } catch (error) {
    next(error);
  }
});

// ── Bookings ──────────────────────────────────────────────────────────────────

// GET /bookings
router.get('/bookings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, page = '1', limit = '20' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = {};
    if (status) where.status = status;

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          kookerProfile: {
            include: { user: { select: { id: true, firstName: true, lastName: true } } },
          },
          service: { select: { id: true, title: true, type: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.booking.count({ where }),
    ]);

    res.json({ success: true, data: { bookings, total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    next(error);
  }
});

// ── Services ──────────────────────────────────────────────────────────────────

// GET /services
router.get('/services', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        include: {
          kookerProfile: {
            include: { user: { select: { id: true, firstName: true, lastName: true } } },
          },
          _count: { select: { bookings: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.service.count(),
    ]);

    res.json({ success: true, data: { services, total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    next(error);
  }
});

// ── Testimonials ──────────────────────────────────────────────────────────────

// GET /testimonials
router.get('/testimonials', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const testimonials = await prisma.testimonial.findMany({
      include: {
        kookerProfile: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: testimonials });
  } catch (error) {
    next(error);
  }
});

// PUT /testimonials/:id
router.put('/testimonials/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const { featured, authorName, authorRole, content, rating } = req.body;

    const data: any = {};
    if (featured !== undefined) data.featured = featured;
    if (authorName !== undefined) data.authorName = authorName;
    if (authorRole !== undefined) data.authorRole = authorRole;
    if (content !== undefined) data.content = content;
    if (rating !== undefined) data.rating = rating;

    const testimonial = await prisma.testimonial.update({ where: { id }, data });
    res.json({ success: true, data: testimonial });
  } catch (error) {
    next(error);
  }
});

// DELETE /testimonials/:id
router.delete('/testimonials/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.testimonial.delete({ where: { id } });
    res.json({ success: true, data: { message: 'Témoignage supprimé' } });
  } catch (error) {
    next(error);
  }
});

// ── Config ────────────────────────────────────────────────────────────────────

// GET /config
router.get('/config', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const configs = await prisma.config.findMany({ orderBy: { key: 'asc' } });
    const result: Record<string, any> = {};
    for (const c of configs) {
      try {
        result[c.key] = JSON.parse(c.value);
      } catch {
        result[c.key] = c.value;
      }
    }
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// PUT /config/:key
router.put('/config/:key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    const config = await prisma.config.upsert({
      where: { key },
      update: { value: JSON.stringify(value) },
      create: { key, value: JSON.stringify(value) },
    });

    res.json({ success: true, data: { key: config.key, value: JSON.parse(config.value) } });
  } catch (error) {
    next(error);
  }
});

// ── Business KPIs ─────────────────────────────────────────────────────────────

function getPeriodDates(period: string) {
  const now = new Date();
  let currentStart: Date, previousStart: Date, previousEnd: Date;
  if (period === 'day') {
    currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    previousStart = new Date(currentStart.getTime() - 86_400_000);
    previousEnd = new Date(currentStart);
  } else if (period === 'week') {
    const dayOfWeek = (now.getDay() + 6) % 7; // 0=Mon
    currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
    previousStart = new Date(currentStart.getTime() - 7 * 86_400_000);
    previousEnd = new Date(currentStart);
  } else {
    currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
    previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    previousEnd = new Date(currentStart);
  }
  return { currentStart, previousStart, previousEnd, now };
}

function pctDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

// GET /kpis?period=day|week|month
router.get('/kpis', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = (['day', 'week', 'month'].includes(req.query.period as string) ? req.query.period : 'month') as string;
    const { currentStart, previousStart, previousEnd, now } = getPeriodDates(period);

    const [
      curRevenue, prevRevenue,
      curUsers, prevUsers,
      curBookings, prevBookings,
      curKookers, prevKookers,
    ] = await Promise.all([
      prisma.booking.aggregate({ _sum: { totalPriceInCents: true }, where: { status: { in: ['confirmed', 'completed'] }, createdAt: { gte: currentStart, lte: now } } }),
      prisma.booking.aggregate({ _sum: { totalPriceInCents: true }, where: { status: { in: ['confirmed', 'completed'] }, createdAt: { gte: previousStart, lt: previousEnd } } }),
      prisma.user.count({ where: { createdAt: { gte: currentStart, lte: now } } }),
      prisma.user.count({ where: { createdAt: { gte: previousStart, lt: previousEnd } } }),
      prisma.booking.count({ where: { createdAt: { gte: currentStart, lte: now } } }),
      prisma.booking.count({ where: { createdAt: { gte: previousStart, lt: previousEnd } } }),
      prisma.kookerProfile.count({ where: { createdAt: { gte: currentStart, lte: now } } }),
      prisma.kookerProfile.count({ where: { createdAt: { gte: previousStart, lt: previousEnd } } }),
    ]);

    const curRev = curRevenue._sum.totalPriceInCents ?? 0;
    const prevRev = prevRevenue._sum.totalPriceInCents ?? 0;

    res.json({
      success: true,
      data: {
        period,
        revenue: { current: curRev, previous: prevRev, delta: pctDelta(curRev, prevRev) },
        users: { current: curUsers, previous: prevUsers, delta: pctDelta(curUsers, prevUsers) },
        bookings: { current: curBookings, previous: prevBookings, delta: pctDelta(curBookings, prevBookings) },
        kookers: { current: curKookers, previous: prevKookers, delta: pctDelta(curKookers, prevKookers) },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /business-charts
router.get('/business-charts', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7;
    const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
    const twelveWeeksAgo = new Date(thisMonday.getTime() - 11 * 7 * 86_400_000);

    const [rawUsers, rawKookers, bookingStatuses, kookerRevGroups, ratingAgg, totalBookings, cancelledCount, completedCount, recentBookings] = await Promise.all([
      prisma.user.findMany({ where: { createdAt: { gte: twelveWeeksAgo } }, select: { createdAt: true } }),
      prisma.kookerProfile.findMany({ where: { createdAt: { gte: twelveWeeksAgo } }, select: { createdAt: true } }),
      prisma.booking.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.booking.groupBy({
        by: ['kookerProfileId'],
        where: { status: { in: ['confirmed', 'completed'] } },
        _sum: { totalPriceInCents: true },
        _count: { id: true },
        orderBy: { _sum: { totalPriceInCents: 'desc' } },
        take: 5,
      }),
      prisma.kookerProfile.aggregate({ _avg: { rating: true }, where: { reviewCount: { gt: 0 } } }),
      prisma.booking.count(),
      prisma.booking.count({ where: { status: 'cancelled' } }),
      prisma.booking.count({ where: { status: 'completed' } }),
      prisma.booking.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { firstName: true, lastName: true } },
          service: { select: { title: true } },
        },
      }),
    ]);

    // Build 12-week acquisition chart
    const weeks: Array<{ label: string; start: Date; end: Date; users: number; kookers: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const start = new Date(thisMonday.getTime() - i * 7 * 86_400_000);
      const end = new Date(start.getTime() + 7 * 86_400_000);
      const dd = String(start.getDate()).padStart(2, '0');
      const mm = String(start.getMonth() + 1).padStart(2, '0');
      weeks.push({ label: `${dd}/${mm}`, start, end, users: 0, kookers: 0 });
    }
    for (const u of rawUsers) {
      const w = weeks.find(w => u.createdAt >= w.start && u.createdAt < w.end);
      if (w) w.users++;
    }
    for (const k of rawKookers) {
      const w = weeks.find(w => k.createdAt >= w.start && k.createdAt < w.end);
      if (w) w.kookers++;
    }
    const acquisition = weeks.map(({ label, users, kookers }) => ({ label, users, kookers }));

    // Top kookers
    const kookerIds = kookerRevGroups.map(k => k.kookerProfileId);
    const kookerDetails = await prisma.kookerProfile.findMany({
      where: { id: { in: kookerIds } },
      select: { id: true, city: true, user: { select: { firstName: true, lastName: true } } },
    });
    const topKookers = kookerRevGroups.map(k => {
      const detail = kookerDetails.find(d => d.id === k.kookerProfileId);
      return {
        id: k.kookerProfileId,
        name: detail ? `${detail.user.firstName} ${detail.user.lastName}` : '—',
        city: detail?.city ?? '—',
        revenueInCents: k._sum.totalPriceInCents ?? 0,
        bookingCount: k._count.id,
      };
    });

    res.json({
      success: true,
      data: {
        acquisition,
        bookingsByStatus: bookingStatuses.map(b => ({ status: b.status, count: b._count.id })),
        topKookers,
        platformHealth: {
          avgRating: Math.round((ratingAgg._avg.rating ?? 0) * 10) / 10,
          cancellationRate: totalBookings > 0 ? Math.round((cancelledCount / totalBookings) * 100) : 0,
          completionRate: totalBookings > 0 ? Math.round((completedCount / totalBookings) * 100) : 0,
        },
        recentBookings: recentBookings.map(b => ({
          id: b.id,
          user: `${b.user.firstName} ${b.user.lastName}`,
          service: b.service.title,
          status: b.status,
          totalPriceInCents: b.totalPriceInCents,
          date: b.date,
          createdAt: b.createdAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── Technical Stats ────────────────────────────────────────────────────────────

function getDirSizeBytes(dirPath: string): number {
  let total = 0;
  try {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const full = path.join(dirPath, entry.name);
      total += entry.isDirectory() ? getDirSizeBytes(full) : fs.statSync(full).size;
    }
  } catch {}
  return total;
}

// GET /tech-stats
router.get('/tech-stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const pingStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbPingMs = Date.now() - pingStart;

    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);

    const [userCount, kookerCount, serviceCount, bookingCount, messageCount, reviewCount, errorLogs, pageTimings] = await Promise.all([
      prisma.user.count(),
      prisma.kookerProfile.count(),
      prisma.service.count(),
      prisma.booking.count(),
      prisma.message.count(),
      prisma.review.count(),
      prisma.errorLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.pageViewLog.groupBy({
        by: ['page'],
        where: { createdAt: { gte: sevenDaysAgo } },
        _avg: { loadTimeMs: true },
        _count: { loadTimeMs: true },
        orderBy: { _avg: { loadTimeMs: 'desc' } },
      }),
    ]);

    const uploadsPath = path.resolve(__dirname, '../../../uploads');
    const uploadSizeBytes = getDirSizeBytes(uploadsPath);
    const uploadSizeMb = Math.round(uploadSizeBytes / (1024 * 1024) * 100) / 100;

    res.json({
      success: true,
      data: {
        dbPingMs,
        tableCounts: { users: userCount, kookers: kookerCount, services: serviceCount, bookings: bookingCount, messages: messageCount, reviews: reviewCount },
        uploadSizeMb,
        errorLogs: errorLogs.map(e => ({
          id: e.id,
          message: e.message,
          route: e.route,
          method: e.method,
          statusCode: e.statusCode,
          createdAt: e.createdAt,
        })),
        pageTimings: pageTimings.map(p => ({
          page: p.page,
          avgLoadTimeMs: Math.round(p._avg.loadTimeMs ?? 0),
          count: p._count.loadTimeMs,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
