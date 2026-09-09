import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, requireKooker } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createReviewSchema, createKookerReviewSchema } from '../schemas/review.js';
import { AppError } from '../utils/errors.js';
import { sendNewReviewPendingToAdmins } from '../lib/email.js';

const router = Router();

// GET /kooker/:id - Get reviews for a kooker profile
router.get('/kooker/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const kookerProfileId = parseInt(req.params.id, 10);
    if (isNaN(kookerProfileId)) {
      throw new AppError('ID invalide', 400);
    }

    const reviews = await prisma.review.findMany({
      where: { kookerProfileId, type: 'user_to_kooker', status: 'approved' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: reviews,
    });
  } catch (error) {
    next(error);
  }
});

// GET /booking/:id - Get reviews for a specific booking (user-to-kooker and kooker-to-user)
router.get('/booking/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookingId = parseInt(req.params.id, 10);
    if (isNaN(bookingId)) throw new AppError('ID invalide', 400);

    const reviews = await prisma.review.findMany({
      where: { bookingId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ success: true, data: reviews });
  } catch (error) {
    next(error);
  }
});

// POST / - Create user-to-kooker review and recalculate kooker's average rating
router.post(
  '/',
  authenticate,
  validate(createReviewSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { kookerProfileId, bookingId, rating, comment } = req.body;

      // Check if kooker profile exists
      const kookerProfile = await prisma.kookerProfile.findUnique({
        where: { id: kookerProfileId },
      });

      if (!kookerProfile) {
        throw new AppError('Profil kooker non trouve', 404);
      }

      // Prevent reviewing yourself
      if (kookerProfile.userId === userId) {
        throw new AppError('Vous ne pouvez pas laisser un avis sur votre propre profil', 400);
      }

      // If bookingId provided, check booking is completed and belongs to user
      if (bookingId) {
        const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
        if (!booking || booking.userId !== userId) {
          throw new AppError('Réservation invalide', 400);
        }
        if (booking.status !== 'completed') {
          throw new AppError('La prestation doit être confirmée avant de laisser un avis', 400);
        }
        // Check for existing review on this booking
        const existingOnBooking = await prisma.review.findFirst({
          where: { bookingId, userId, type: 'user_to_kooker' },
        });
        if (existingOnBooking) {
          throw new AppError('Vous avez déjà laissé un avis pour cette réservation', 409);
        }
      } else {
        // Check for existing review (legacy: one per user per kooker)
        const existingReview = await prisma.review.findFirst({
          where: { userId, kookerProfileId, type: 'user_to_kooker' },
        });
        if (existingReview) {
          throw new AppError('Vous avez deja laisse un avis pour ce kooker', 409);
        }
      }

      // Create the review in pending state (requires admin approval)
      const review = await prisma.review.create({
        data: {
          userId,
          kookerProfileId,
          bookingId: bookingId || null,
          type: 'user_to_kooker',
          status: 'pending',
          rating,
          comment,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      });

      // Note: rating recalculation happens only when admin approves — not on creation

      // Notify admins asynchronously (don't await — don't block the response)
      const kookerWithUser = await prisma.kookerProfile.findUnique({
        where: { id: kookerProfileId },
        include: { user: { select: { firstName: true, lastName: true } } },
      });
      sendNewReviewPendingToAdmins(
        `${review.user.firstName} ${review.user.lastName}`,
        kookerWithUser ? `${kookerWithUser.user.firstName} ${kookerWithUser.user.lastName}` : `Kooker #${kookerProfileId}`,
        rating,
        comment,
        kookerProfileId
      ).catch(() => {});

      res.status(201).json({
        success: true,
        data: { ...review, status: 'pending' },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /kooker-to-user - Kooker rates a user after a completed booking
router.post(
  '/kooker-to-user',
  authenticate,
  requireKooker,
  validate(createKookerReviewSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const kookerProfileId = req.user!.kookerProfileId!;
      const { bookingId, rating, comment } = req.body;

      // Verify booking exists and belongs to this kooker
      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      if (!booking) throw new AppError('Réservation non trouvée', 404);
      if (booking.kookerProfileId !== kookerProfileId) {
        throw new AppError('Cette réservation ne vous appartient pas', 403);
      }
      if (booking.status !== 'completed') {
        throw new AppError('La prestation doit être terminée', 400);
      }

      // Check that user has already left a review on this booking
      const userReview = await prisma.review.findFirst({
        where: { bookingId, type: 'user_to_kooker' },
      });
      if (!userReview) {
        throw new AppError('Le client doit d\'abord laisser un avis avant que vous puissiez noter', 400);
      }

      // Check kooker hasn't already reviewed this booking
      const existingKookerReview = await prisma.review.findFirst({
        where: { bookingId, type: 'kooker_to_user' },
      });
      if (existingKookerReview) {
        throw new AppError('Vous avez déjà noté ce client pour cette réservation', 409);
      }

      const review = await prisma.review.create({
        data: {
          userId,
          kookerProfileId,
          bookingId,
          type: 'kooker_to_user',
          targetUserId: booking.userId,
          rating,
          comment,
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        },
      });

      res.status(201).json({ success: true, data: review });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
