import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateUserProfileSchema, updateHostingProfileSchema } from '../schemas/kooker.js';
import { signToken, INACTIVITY_TIMEOUT_MS } from '../utils/jwt.js';
import { env } from '../config/env.js';
import { sendEmailChangeVerification } from '../lib/email.js';
import crypto from 'crypto';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: INACTIVITY_TIMEOUT_MS,
  path: '/',
};

const router = Router();

// PUT /profile - Update user profile
router.put(
  '/profile',
  authenticate,
  validate(updateUserProfileSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { firstName, lastName, phone, email } = req.body;

      const currentUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!currentUser) {
        return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
      }

      // If email is being changed, send verification to new address instead of updating directly
      if (email !== undefined && email !== currentUser.email) {
        const existing = await prisma.user.findFirst({
          where: { email, NOT: { id: userId } },
        });
        if (existing) {
          return res.status(409).json({ success: false, error: 'Cet email est déjà utilisé par un autre compte.' });
        }

        // Save other fields immediately, store new email as pending
        const otherData: Record<string, unknown> = { pendingEmail: email };
        if (firstName !== undefined) otherData.firstName = firstName;
        if (lastName !== undefined) otherData.lastName = lastName;
        if (phone !== undefined) otherData.phone = phone;

        await prisma.user.update({ where: { id: userId }, data: otherData });

        // Create email change token (24h)
        await prisma.emailToken.deleteMany({ where: { userId, type: 'change_email' } });
        const token = crypto.randomBytes(32).toString('hex');
        await prisma.emailToken.create({
          data: { userId, token, type: 'change_email', expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
        });

        const verifyUrl = `${env.APP_URL}/confirmer-email?token=${token}`;
        sendEmailChangeVerification(email, currentUser.firstName, verifyUrl).catch(() => {});

        const updated = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, firstName: true, lastName: true, phone: true, avatar: true, role: true, createdAt: true, pendingEmail: true },
        });

        return res.json({ success: true, data: { ...updated, pendingEmailChange: true } });
      }

      const data: Record<string, unknown> = {};
      if (firstName !== undefined) data.firstName = firstName;
      if (lastName !== undefined) data.lastName = lastName;
      if (phone !== undefined) data.phone = phone;

      const updated = await prisma.user.update({
        where: { id: userId },
        data,
        select: { id: true, email: true, firstName: true, lastName: true, phone: true, avatar: true, role: true, createdAt: true },
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
);

// GET /confirm-email-change?token=xxx
router.get(
  '/confirm-email-change',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.query as { token: string };
      if (!token) {
        res.status(400).json({ success: false, error: 'Token manquant.' });
        return;
      }

      const emailToken = await prisma.emailToken.findUnique({
        where: { token },
        include: { user: { include: { kookerProfile: { select: { id: true } } } } },
      });

      if (!emailToken || emailToken.type !== 'change_email' || emailToken.used || emailToken.expiresAt < new Date()) {
        res.status(400).json({ success: false, error: 'Ce lien est invalide ou a expiré.' });
        return;
      }

      const user = emailToken.user;
      if (!user.pendingEmail) {
        res.status(400).json({ success: false, error: "Aucun changement d'email en attente." });
        return;
      }

      const newEmail = user.pendingEmail;

      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { email: newEmail, pendingEmail: null } }),
        prisma.emailToken.update({ where: { id: emailToken.id }, data: { used: true } }),
      ]);

      const jwtToken = signToken({ userId: user.id, email: newEmail });
      res.cookie('token', jwtToken, COOKIE_OPTIONS);

      res.json({
        success: true,
        data: {
          id: user.id,
          email: newEmail,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          avatar: user.avatar,
          role: user.role,
          isAdmin: user.isAdmin,
          createdAt: user.createdAt,
          kookerProfileId: user.kookerProfile?.id || null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /avatar - Update user avatar URL
router.put(
  '/avatar',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { avatar } = req.body;

      if (!avatar || typeof avatar !== 'string') {
        return res.status(400).json({
          success: false,
          error: "L'URL de l'avatar est requise",
        });
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: { avatar },
        select: { id: true, email: true, firstName: true, lastName: true, phone: true, avatar: true, role: true, createdAt: true },
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
);

// GET /hosting-profile - Get user hosting profile
router.get(
  '/hosting-profile',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const profile = await prisma.userProfile.findUnique({ where: { userId } });
      res.json({ success: true, data: profile ?? null });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /hosting-profile - Upsert user hosting profile
router.put(
  '/hosting-profile',
  authenticate,
  validate(updateHostingProfileSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const {
        address, addressComplement, city, postalCode, country,
        accessCode, floor, intercom, parkingInfo,
        stoveType, hasOven, hasDishwasher, tableCapacity, kitchenNotes,
        dietaryRestrictions, allergies, hostingNotes,
      } = req.body;

      const data: Record<string, unknown> = {};
      if (address             !== undefined) data.address             = address;
      if (addressComplement   !== undefined) data.addressComplement   = addressComplement;
      if (city                !== undefined) data.city                = city;
      if (postalCode          !== undefined) data.postalCode          = postalCode;
      if (country             !== undefined) data.country             = country;
      if (accessCode          !== undefined) data.accessCode          = accessCode;
      if (floor               !== undefined) data.floor               = floor;
      if (intercom            !== undefined) data.intercom            = intercom;
      if (parkingInfo         !== undefined) data.parkingInfo         = parkingInfo;
      if (stoveType           !== undefined) data.stoveType           = stoveType;
      if (hasOven             !== undefined) data.hasOven             = hasOven;
      if (hasDishwasher       !== undefined) data.hasDishwasher       = hasDishwasher;
      if (tableCapacity       !== undefined) data.tableCapacity       = tableCapacity;
      if (kitchenNotes        !== undefined) data.kitchenNotes        = kitchenNotes;
      if (dietaryRestrictions !== undefined) data.dietaryRestrictions = dietaryRestrictions;
      if (allergies           !== undefined) data.allergies           = allergies;
      if (hostingNotes        !== undefined) data.hostingNotes        = hostingNotes;

      const profile = await prisma.userProfile.upsert({
        where:  { userId },
        update: data,
        create: { userId, ...data },
      });

      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
