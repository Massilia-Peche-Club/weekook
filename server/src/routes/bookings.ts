import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import stripe from '../lib/stripe.js';
import { executeStripeTransfer } from '../lib/bookingTransfer.js';
import { authenticate, requireKooker } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createBookingSchema, updateBookingStatusSchema, updateBookingDetailsSchema } from '../schemas/booking.js';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors.js';
import {
  sendBookingRequestToKooker,
  sendBookingConfirmedToUser,
  sendBookingCancelledToUser,
  sendBookingCancelledToKooker,
  sendBookingModifiedToKooker,
  sendBookingModifiedToUser,
  sendCompletionToKooker,
} from '../lib/email.js';

// Envoie un message système dans la messagerie interne (fire-and-forget)
async function sendSystemMessage(senderId: number, receiverId: number, content: string, kookerRecipientId: number, bookingId?: number): Promise<void> {
  try {
    await prisma.message.create({ data: { senderId, receiverId, content, kookerRecipientId, ...(bookingId ? { bookingId } : {}) } });
  } catch (err) {
    console.error('[booking] Failed to send system message:', err);
  }
}

const router = Router();

// GET /my - Get current user's bookings
router.get(
  '/my',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const t0 = Date.now();
      console.log(`[bookings/my] userId=${userId} - start`);

      const bookings = await prisma.booking.findMany({
        where: { userId },
        include: {
          service: {
            select: {
              id: true,
              title: true,
              type: true,
              priceInCents: true,
              durationMinutes: true,
            },
          },
          kookerProfile: {
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
          },
          reviews: {
            where: { userId, type: 'user_to_kooker' },
            select: { id: true },
          },
        },
        orderBy: { date: 'desc' },
      });

      console.log(`[bookings/my] userId=${userId} - query done in ${Date.now() - t0}ms, found ${bookings.length}`);

      res.json({
        success: true,
        data: bookings,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /kooker - Get bookings received as kooker
router.get(
  '/kooker',
  authenticate,
  requireKooker,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const kookerProfileId = req.user!.kookerProfileId!;

      const bookings = await prisma.booking.findMany({
        where: { kookerProfileId },
        include: {
          service: {
            select: {
              id: true,
              title: true,
              type: true,
              priceInCents: true,
              durationMinutes: true,
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              avatar: true,
            },
          },
        },
        orderBy: { date: 'desc' },
      });

      res.json({
        success: true,
        data: bookings,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /:id - Get single booking (owner or kooker)
router.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError('ID invalide', 400);

      const userId = req.user!.userId;
      const kookerProfileId = req.user!.kookerProfileId;

      const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
          service: {
            select: { id: true, title: true, type: true, priceInCents: true, durationMinutes: true, description: true, koursDifficulty: true, koursLocation: true, equipmentProvided: true, ingredientsList: true, ingredientsBaseServings: true, ingredientsPricePerGuestInCents: true, ingredientsDefaultSource: true },
          },
          kookerProfile: {
            include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
          },
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, avatar: true, phone: true },
          },
        },
      });

      if (!booking) throw new NotFoundError('Réservation non trouvée');

      const isOwner = booking.userId === userId;
      const isKooker = kookerProfileId && booking.kookerProfileId === kookerProfileId;
      if (!isOwner && !isKooker) throw new ForbiddenError('Accès refusé');

      res.json({ success: true, data: booking });
    } catch (error) {
      next(error);
    }
  }
);

// POST / - Create booking + Stripe PaymentIntent (manual capture)
router.post(
  '/',
  authenticate,
  validate(createBookingSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { serviceId, date, startTime, guests, notes, ingredientsSource } = req.body;

      // Validate date is not in the past
      const bookingDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (bookingDate < today) {
        throw new AppError('La date de réservation est dépassée', 400);
      }

      // Get the service to calculate total price and find kooker
      const service = await prisma.service.findUnique({
        where: { id: serviceId },
        select: {
          id: true,
          type: true,
          priceInCents: true,
          extraGuestPriceInCents: true,
          ingredientsPricePerGuestInCents: true,
          durationMinutes: true,
          kookerProfileId: true,
          maxGuests: true,
          active: true,
        },
      });

      if (!service) {
        throw new NotFoundError('Service non trouve');
      }

      if (!service.active) {
        throw new AppError('Ce service n\'est plus disponible', 400);
      }

      if (guests > service.maxGuests) {
        throw new AppError(
          `Le nombre maximum d'invites pour ce service est ${service.maxGuests}`,
          400
        );
      }

      // Verify Stripe is configured and kooker has completed onboarding
      if (!stripe) {
        throw new AppError('Les paiements Stripe ne sont pas configurés sur ce serveur.', 503);
      }

      const kookerProfile = await prisma.kookerProfile.findUnique({
        where: { id: service.kookerProfileId },
        select: { stripeAccountId: true, stripeOnboardingComplete: true },
      });

      if (!kookerProfile?.stripeAccountId || !kookerProfile.stripeOnboardingComplete) {
        throw new AppError('Ce kooker n\'accepte pas encore les paiements en ligne. Veuillez réessayer plus tard.', 400);
      }

      // Auto-calculate total price
      // COURS: base price covers 1-6 guests, then extra per guest beyond 6
      // KOOK: price per guest
      const serviceTypes: string[] = Array.isArray(service.type) ? service.type : JSON.parse(String(service.type) || '[]');
      const isKours = serviceTypes.includes('COURS');
      let totalPriceInCents: number;
      if (isKours) {
        const extraGuests = Math.max(0, guests - 6);
        totalPriceInCents = service.priceInCents + extraGuests * (service.extraGuestPriceInCents ?? 0);
      } else {
        totalPriceInCents = service.priceInCents * guests;
      }

      // Surcoût ingrédients si le kooker fournit les courses
      if (ingredientsSource === 'kooker' && service.ingredientsPricePerGuestInCents) {
        totalPriceInCents += service.ingredientsPricePerGuestInCents * guests;
      }

      // Create booking
      const booking = await prisma.booking.create({
        data: {
          userId,
          kookerProfileId: service.kookerProfileId,
          serviceId,
          date: new Date(date),
          startTime,
          guests,
          totalPriceInCents,
          notes,
          ingredientsSource: ingredientsSource ?? 'client',
          paymentStatus: 'pending_authorization',
        },
        include: {
          service: {
            select: {
              id: true,
              title: true,
              type: true,
              priceInCents: true,
              durationMinutes: true,
            },
          },
          kookerProfile: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
          },
        },
      });

      // Create Stripe PaymentIntent with manual capture
      // Payment stays on platform until prestation is completed, then transferred to kooker
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalPriceInCents,
        currency: 'eur',
        capture_method: 'manual',
        metadata: {
          bookingId: String(booking.id),
          userId: String(userId),
          serviceId: String(serviceId),
          kookerProfileId: String(service.kookerProfileId),
        },
      });

      // Save PaymentIntent ID on the booking
      await prisma.booking.update({
        where: { id: booking.id },
        data: { stripePaymentIntentId: paymentIntent.id },
      });

      // Create audit record
      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          stripePaymentIntentId: paymentIntent.id,
          type: 'authorization',
          amountInCents: totalPriceInCents,
          status: 'pending',
        },
      });

      res.status(201).json({
        success: true,
        data: {
          booking,
          clientSecret: paymentIntent.client_secret,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /:id/confirm-payment - Confirm payment after Stripe card authorization
router.post(
  '/:id/confirm-payment',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError('ID invalide', 400);

      const userId = req.user!.userId;

      const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
          service: { select: { title: true } },
          user: { select: { firstName: true, lastName: true } },
          kookerProfile: {
            include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
          },
        },
      });

      if (!booking) throw new NotFoundError('Réservation non trouvée');
      if (booking.userId !== userId) throw new ForbiddenError('Accès refusé');

      if (booking.paymentStatus !== 'pending_authorization') {
        return res.json({ success: true, data: { status: booking.paymentStatus } });
      }

      // Check booking date is not in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(booking.date) < today) {
        // Cancel PaymentIntent and booking
        if (stripe && booking.stripePaymentIntentId) {
          try { await stripe.paymentIntents.cancel(booking.stripePaymentIntentId); } catch (e) { console.error('[booking] Stripe cancel error:', e); }
        }
        await prisma.booking.update({ where: { id }, data: { status: 'cancelled', paymentStatus: 'cancelled' } });
        throw new AppError('La date de réservation est dépassée, la réservation a été annulée', 400);
      }

      // Verify PaymentIntent status with Stripe
      if (stripe && booking.stripePaymentIntentId) {
        const pi = await stripe.paymentIntents.retrieve(booking.stripePaymentIntentId);
        if (pi.status !== 'requires_capture') {
          throw new AppError(`Statut de paiement inattendu : ${pi.status}`, 400);
        }
      }

      // Update payment status + audit record in parallel
      await Promise.all([
        prisma.booking.update({
          where: { id },
          data: { paymentStatus: 'authorized' },
        }),
        booking.stripePaymentIntentId
          ? prisma.payment.updateMany({
              where: { bookingId: id, type: 'authorization', status: 'pending' },
              data: { status: 'succeeded' },
            })
          : Promise.resolve(),
      ]);

      // Send notifications to kooker (moved here from booking creation)
      const kookerUser = booking.kookerProfile.user as { id: number; email: string; firstName: string; lastName: string };
      const clientName = `${booking.user.firstName} ${booking.user.lastName}`.trim();
      const kookerName = `${kookerUser.firstName} ${kookerUser.lastName}`.trim();

      sendBookingRequestToKooker(
        kookerUser.email,
        kookerName,
        clientName,
        booking.service.title,
        booking.date,
        booking.startTime,
        booking.guests,
        booking.totalPriceInCents
      );

      sendSystemMessage(
        userId,
        kookerUser.id,
        `📅 Nouvelle demande de réservation pour "${booking.service.title}" le ${new Date(booking.date).toLocaleDateString('fr-FR')} à ${booking.startTime} (${booking.guests} convive${booking.guests > 1 ? 's' : ''}). Montant : ${(booking.totalPriceInCents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}.`,
        booking.kookerProfileId,
        booking.id
      );

      res.json({ success: true, data: { status: 'authorized' } });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /:id/confirm-completion - User confirms the prestation happened
router.put(
  '/:id/confirm-completion',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError('ID invalide', 400);

      const userId = req.user!.userId;

      const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
          service: { select: { title: true } },
          kookerProfile: {
            include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
          },
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      if (!booking) throw new NotFoundError('Réservation non trouvée');
      if (booking.userId !== userId) throw new ForbiddenError('Accès refusé');
      if (booking.status !== 'awaiting_confirmation') {
        throw new AppError('Cette réservation n\'est pas en attente de confirmation.', 400);
      }

      // Mark as completed
      const updated = await prisma.booking.update({
        where: { id },
        data: { status: 'completed' },
      });

      // Transfer funds to kooker
      await executeStripeTransfer(id);

      // Notifications
      const kookerUser = (booking.kookerProfile as any).user as { id: number; email: string; firstName: string; lastName: string };
      const clientName = `${booking.user.firstName} ${booking.user.lastName}`.trim();
      const kookerName = `${kookerUser.firstName} ${kookerUser.lastName}`.trim();

      sendCompletionToKooker(
        kookerUser.email,
        kookerName,
        clientName,
        booking.service.title,
        booking.date,
        booking.totalPriceInCents
      );

      sendSystemMessage(
        userId,
        kookerUser.id,
        `✅ ${clientName} a confirmé la réalisation de la prestation "${booking.service.title}". Le paiement va être versé sur votre compte.`,
        booking.kookerProfileId,
        id
      );

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /:id - Edit booking details (user if pending, kooker if not completed/cancelled)
router.put(
  '/:id',
  authenticate,
  validate(updateBookingDetailsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError('ID invalide', 400);

      const userId = req.user!.userId;
      const kookerProfileId = req.user!.kookerProfileId;
      const { date, startTime, guests, notes } = req.body;

      const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
          service: { select: { id: true, title: true, priceInCents: true } },
          kookerProfile: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } },
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });

      if (!booking) throw new NotFoundError('Réservation non trouvée');

      const isOwner = booking.userId === userId;
      const isKooker = kookerProfileId && booking.kookerProfileId === kookerProfileId;
      if (!isOwner && !isKooker) throw new ForbiddenError('Accès refusé');

      if (isOwner && booking.status !== 'pending') {
        throw new AppError('Vous ne pouvez modifier une réservation qu\'en attente de validation', 400);
      }
      if (isKooker && (booking.status === 'completed' || booking.status === 'cancelled')) {
        throw new AppError('Cette réservation ne peut plus être modifiée', 400);
      }

      const formatDateFR = (d: Date | string) =>
        new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

      const updateData: Record<string, unknown> = {};
      const changes: string[] = [];

      if (date) {
        const oldDate = booking.date.toISOString().slice(0, 10);
        if (oldDate !== date) {
          changes.push(`Date : ${formatDateFR(booking.date)} → ${formatDateFR(new Date(date))}`);
          updateData.date = new Date(date);
        }
      }
      if (startTime) {
        const oldTime = String(booking.startTime).slice(0, 5);
        if (oldTime !== startTime) {
          changes.push(`Heure : ${oldTime} → ${startTime}`);
          updateData.startTime = startTime;
        }
      }
      if (isOwner && typeof guests === 'number' && guests !== booking.guests) {
        changes.push(`Convives : ${booking.guests} → ${guests}`);
        updateData.guests = guests;
        // Recalculate price: COURS uses base + extra beyond 6, KOOK uses per-guest
        const svc = await prisma.service.findUnique({
          where: { id: (booking.service as any).id },
          select: { type: true, priceInCents: true, extraGuestPriceInCents: true },
        });
        const svcTypes: string[] = svc ? (Array.isArray(svc.type) ? svc.type : JSON.parse(String(svc.type) || '[]')) : [];
        if (svcTypes.includes('COURS') && svc) {
          const extraGuests = Math.max(0, guests - 6);
          updateData.totalPriceInCents = svc.priceInCents + extraGuests * (svc.extraGuestPriceInCents ?? 0);
        } else {
          updateData.totalPriceInCents = (booking.service as any).priceInCents * guests;
        }
      }
      if (typeof notes !== 'undefined') {
        const oldNotes = booking.notes || '';
        const newNotes = notes || '';
        if (oldNotes !== newNotes) {
          changes.push('Notes mises à jour');
          updateData.notes = notes;
        }
      }

      if (changes.length === 0) {
        return res.json({ success: true, data: booking });
      }

      const updated = await prisma.booking.update({
        where: { id },
        data: updateData,
        include: {
          service: { select: { id: true, title: true, type: true, priceInCents: true, durationMinutes: true, description: true, koursDifficulty: true, koursLocation: true, equipmentProvided: true } },
          kookerProfile: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } } } },
          user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true, phone: true } },
        },
      });

      // Notifications (fire-and-forget)
      const changesText = changes.join('\n');
      const clientUser = booking.user;
      const kookerUser = (booking.kookerProfile as any).user as { id: number; email: string; firstName: string; lastName: string };
      const clientName = `${clientUser.firstName} ${clientUser.lastName}`.trim();
      const kookerName = `${kookerUser.firstName} ${kookerUser.lastName}`.trim();
      const serviceTitle = (booking.service as any).title;

      if (isOwner) {
        sendBookingModifiedToKooker(kookerUser.email, kookerName, clientName, serviceTitle, changesText, id);
        sendSystemMessage(
          userId, kookerUser.id,
          `✏️ ${clientName} a modifié sa réservation pour "${serviceTitle}".\n\nModifications :\n${changesText}`,
          booking.kookerProfileId, id
        );
      } else {
        sendBookingModifiedToUser(clientUser.email, clientName, kookerName, serviceTitle, changesText, id);
        sendSystemMessage(
          kookerUser.id, clientUser.id,
          `✏️ ${kookerName} a modifié votre réservation pour "${serviceTitle}".\n\nModifications :\n${changesText}`,
          booking.kookerProfileId, id
        );
      }

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /:id/status - Update booking status (kooker only) + Stripe capture/transfer/refund
router.put(
  '/:id/status',
  authenticate,
  requireKooker,
  validate(updateBookingStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        throw new AppError('ID invalide', 400);
      }

      const kookerProfileId = req.user!.kookerProfileId!;
      const { status } = req.body;

      // Verify the kooker owns this booking
      const booking = await prisma.booking.findUnique({ where: { id } });
      if (!booking) {
        throw new NotFoundError('Reservation non trouvee');
      }
      if (booking.kookerProfileId !== kookerProfileId) {
        throw new ForbiddenError('Vous ne pouvez modifier que vos propres reservations');
      }

      // ── Date validation: block acceptance if date is past ──
      if (status === 'confirmed') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (new Date(booking.date) < today) {
          // Auto-cancel booking + release pre-auth
          if (stripe && booking.stripePaymentIntentId && (booking.paymentStatus === 'authorized' || booking.paymentStatus === 'pending_authorization')) {
            try { await stripe.paymentIntents.cancel(booking.stripePaymentIntentId); } catch (e) { console.error('[booking] Stripe cancel error:', e); }
          }
          await prisma.booking.update({ where: { id }, data: { status: 'cancelled', paymentStatus: 'cancelled' } });
          throw new AppError('La date est dépassée, la réservation a été annulée automatiquement', 400);
        }
      }

      // ── Stripe: Capture on confirmation ──
      if (status === 'confirmed' && stripe && booking.stripePaymentIntentId) {
        if (booking.paymentStatus !== 'authorized') {
          throw new AppError('Le paiement n\'a pas encore été autorisé pour cette réservation.', 400);
        }
        try {
          await stripe.paymentIntents.capture(booking.stripePaymentIntentId);
          await prisma.booking.update({ where: { id }, data: { paymentStatus: 'captured' } });
          await prisma.payment.create({
            data: {
              bookingId: id,
              stripePaymentIntentId: booking.stripePaymentIntentId,
              type: 'capture',
              amountInCents: booking.totalPriceInCents,
              status: 'succeeded',
            },
          });
        } catch (captureError) {
          console.error('[booking] Stripe capture failed:', captureError);
          await prisma.booking.update({ where: { id }, data: { paymentStatus: 'capture_failed' } });
          throw new AppError('Le paiement du client n\'a pas pu être capturé. La réservation reste en attente.', 400);
        }
      }

      // ── Stripe: Refund/cancel on kooker refuse ──
      if (status === 'cancelled' && stripe && booking.stripePaymentIntentId) {
        try {
          if (booking.paymentStatus === 'authorized') {
            await stripe.paymentIntents.cancel(booking.stripePaymentIntentId);
            await prisma.booking.update({ where: { id }, data: { paymentStatus: 'cancelled' } });
            await prisma.payment.create({
              data: { bookingId: id, stripePaymentIntentId: booking.stripePaymentIntentId, type: 'cancellation', amountInCents: booking.totalPriceInCents, status: 'succeeded' },
            });
          } else if (booking.paymentStatus === 'captured') {
            await stripe.refunds.create({ payment_intent: booking.stripePaymentIntentId });
            await prisma.booking.update({ where: { id }, data: { paymentStatus: 'refunded' } });
            await prisma.payment.create({
              data: { bookingId: id, stripePaymentIntentId: booking.stripePaymentIntentId, type: 'refund', amountInCents: booking.totalPriceInCents, status: 'succeeded' },
            });
          }
        } catch (stripeError) {
          console.error('[booking] Stripe cancel/refund failed:', stripeError);
          await prisma.payment.create({
            data: { bookingId: id, stripePaymentIntentId: booking.stripePaymentIntentId, type: 'refund', amountInCents: booking.totalPriceInCents, status: 'failed', metadata: { error: String(stripeError) } },
          });
        }
      }

      // ── Stripe: Transfer on completion (safety net, normally triggered by user confirm-completion) ──
      if (status === 'completed' && booking.paymentStatus === 'captured') {
        await executeStripeTransfer(id);
      }

      const updated = await prisma.booking.update({
        where: { id },
        data: { status },
        include: {
          service: {
            select: { id: true, title: true },
          },
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          kookerProfile: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      });

      // Notifications (fire-and-forget)
      const clientUser = updated.user as { id: number; email: string; firstName: string; lastName: string };
      const kookerProfileUser = (updated.kookerProfile as any).user as { id: number; firstName: string; lastName: string };
      const kookerName = `${kookerProfileUser.firstName} ${kookerProfileUser.lastName}`.trim();

      if (status === 'confirmed') {
        sendBookingConfirmedToUser(
          clientUser.email,
          `${clientUser.firstName} ${clientUser.lastName}`.trim(),
          kookerName,
          updated.service.title,
          updated.date,
          updated.startTime,
          updated.guests,
          updated.totalPriceInCents
        );
        sendSystemMessage(
          kookerProfileUser.id,
          clientUser.id,
          `✅ Votre réservation pour "${updated.service.title}" le ${new Date(updated.date).toLocaleDateString('fr-FR')} à ${updated.startTime} a été confirmée par ${kookerName} !`,
          kookerProfileId,
          updated.id
        );
      } else if (status === 'cancelled') {
        sendBookingCancelledToUser(
          clientUser.email,
          `${clientUser.firstName} ${clientUser.lastName}`.trim(),
          kookerName,
          updated.service.title,
          updated.date
        );
        sendSystemMessage(
          kookerProfileUser.id,
          clientUser.id,
          `❌ Votre réservation pour "${updated.service.title}" le ${new Date(updated.date).toLocaleDateString('fr-FR')} a été annulée par ${kookerName}.`,
          kookerProfileId,
          updated.id
        );
      }

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /:id/cancel - Cancel booking (user or kooker)
router.put(
  '/:id/cancel',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        throw new AppError('ID invalide', 400);
      }

      const userId = req.user!.userId;
      const kookerProfileId = req.user!.kookerProfileId;

      const booking = await prisma.booking.findUnique({ where: { id } });
      if (!booking) {
        throw new NotFoundError('Reservation non trouvee');
      }

      // User or kooker can cancel
      const isOwner = booking.userId === userId;
      const isKooker = kookerProfileId && booking.kookerProfileId === kookerProfileId;

      if (!isOwner && !isKooker) {
        throw new ForbiddenError('Vous ne pouvez annuler que vos propres reservations');
      }

      if (booking.status === 'cancelled') {
        throw new AppError('Cette reservation est deja annulee', 400);
      }

      if (booking.status === 'completed') {
        throw new AppError('Impossible d\'annuler une reservation terminee', 400);
      }

      // Fetch full booking info before update for notifications
      const fullBooking = await prisma.booking.findUnique({
        where: { id },
        include: {
          service: { select: { title: true } },
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          kookerProfile: {
            include: {
              user: { select: { id: true, email: true, firstName: true, lastName: true } },
            },
          },
        },
      });

      // ── Stripe: cancel hold or refund ──
      if (stripe && booking.stripePaymentIntentId) {
        try {
          if (booking.paymentStatus === 'authorized' || booking.paymentStatus === 'pending_authorization') {
            await stripe.paymentIntents.cancel(booking.stripePaymentIntentId);
            await prisma.booking.update({ where: { id }, data: { paymentStatus: 'cancelled' } });
            await prisma.payment.create({
              data: { bookingId: id, stripePaymentIntentId: booking.stripePaymentIntentId, type: 'cancellation', amountInCents: booking.totalPriceInCents, status: 'succeeded' },
            });
          } else if (booking.paymentStatus === 'captured') {
            await stripe.refunds.create({ payment_intent: booking.stripePaymentIntentId });
            await prisma.booking.update({ where: { id }, data: { paymentStatus: 'refunded' } });
            await prisma.payment.create({
              data: { bookingId: id, stripePaymentIntentId: booking.stripePaymentIntentId, type: 'refund', amountInCents: booking.totalPriceInCents, status: 'succeeded' },
            });
          }
        } catch (stripeError) {
          console.error('[booking] Stripe cancel/refund failed:', stripeError);
          await prisma.payment.create({
            data: { bookingId: id, stripePaymentIntentId: booking.stripePaymentIntentId, type: 'refund', amountInCents: booking.totalPriceInCents, status: 'failed', metadata: { error: String(stripeError) } },
          });
        }
      }

      const updated = await prisma.booking.update({
        where: { id },
        data: { status: 'cancelled' },
      });

      // Notifications (fire-and-forget)
      if (fullBooking) {
        const clientUser = fullBooking.user;
        const kookerUser = (fullBooking.kookerProfile as any).user as { id: number; email: string; firstName: string; lastName: string };
        const clientName = `${clientUser.firstName} ${clientUser.lastName}`.trim();
        const kookerName = `${kookerUser.firstName} ${kookerUser.lastName}`.trim();
        const serviceTitle = fullBooking.service.title;
        const date = fullBooking.date;

        if (isOwner) {
          // User cancelled → notify kooker
          sendBookingCancelledToKooker(kookerUser.email, kookerName, clientName, serviceTitle, date);
          sendSystemMessage(
            clientUser.id,
            kookerUser.id,
            `❌ ${clientName} a annulé sa réservation pour "${serviceTitle}" du ${new Date(date).toLocaleDateString('fr-FR')}.`,
            fullBooking.kookerProfileId
          );
        } else {
          // Kooker cancelled → notify user
          sendBookingCancelledToUser(clientUser.email, clientName, kookerName, serviceTitle, date);
          sendSystemMessage(
            kookerUser.id,
            clientUser.id,
            `❌ Votre réservation pour "${serviceTitle}" du ${new Date(date).toLocaleDateString('fr-FR')} a été annulée par ${kookerName}.`,
            fullBooking.kookerProfileId
          );
        }
      }

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
