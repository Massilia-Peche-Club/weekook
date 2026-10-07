import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { signToken, INACTIVITY_TIMEOUT_MS } from '../utils/jwt.js';
import { authenticate, invalidateAuthCache } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../schemas/auth.js';
import { AppError } from '../utils/errors.js';
import { env } from '../config/env.js';
import { sendPasswordResetEmail, sendEmailVerification } from '../lib/email.js';

const router = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: INACTIVITY_TIMEOUT_MS,
  path: '/',
};

// POST /register
router.post(
  '/register',
  rateLimit(50, 15 * 60 * 1000),
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new AppError('Cette adresse email est déjà associée à un compte.', 409);
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          emailVerified: false,
        },
        select: { id: true, email: true, firstName: true, lastName: true },
      });

      // Create email verification token (24h)
      await prisma.emailToken.deleteMany({ where: { userId: user.id, type: 'verify' } });
      const token = crypto.randomBytes(32).toString('hex');
      await prisma.emailToken.create({
        data: { userId: user.id, token, type: 'verify', expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      });

      const verifyUrl = `${env.APP_URL}/verifier-email?token=${token}`;
      sendEmailVerification(user.email, user.firstName, verifyUrl).catch(() => {});

      res.status(201).json({
        success: true,
        data: { requiresVerification: true, email: user.email },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /login
router.post(
  '/login',
  rateLimit(50, 15 * 60 * 1000),
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({
        where: { email },
        include: { kookerProfile: { select: { id: true } } },
      });

      // Always run bcrypt.compare to prevent timing-based account enumeration (BUG-038)
      const DUMMY_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh3y';
      const isValid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);

      if (!user || !isValid) {
        throw new AppError('Email ou mot de passe incorrect.', 401);
      }

      if (user.emailVerified === false) {
        res.status(403).json({
          success: false,
          error: 'Veuillez confirmer votre adresse email avant de vous connecter.',
          code: 'email_not_verified',
        });
        return;
      }

      const jwtToken = signToken({ userId: user.id, email: user.email });
      res.cookie('token', jwtToken, COOKIE_OPTIONS);

      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
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

// POST /logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token', { path: '/' });
  res.json({ success: true, data: { message: 'Déconnexion réussie' } });
});

// GET /me
router.get(
  '/me',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        include: { kookerProfile: { select: { id: true } } },
      });

      if (!user) {
        throw new AppError('Utilisateur non trouvé', 404);
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
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

// GET /verify-email?token=xxx
router.get(
  '/verify-email',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.query as { token: string };

      if (!token) {
        throw new AppError('Token manquant.', 400);
      }

      const emailToken = await prisma.emailToken.findUnique({
        where: { token },
        include: { user: { include: { kookerProfile: { select: { id: true } } } } },
      });

      if (!emailToken || emailToken.type !== 'verify' || emailToken.used || emailToken.expiresAt < new Date()) {
        throw new AppError('Ce lien est invalide ou a expiré.', 400);
      }

      await prisma.$transaction([
        prisma.user.update({ where: { id: emailToken.userId }, data: { emailVerified: true } }),
        prisma.emailToken.update({ where: { id: emailToken.id }, data: { used: true } }),
      ]);

      const user = emailToken.user;
      const jwtToken = signToken({ userId: user.id, email: user.email });
      res.cookie('token', jwtToken, COOKIE_OPTIONS);

      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
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

// POST /resend-verification
router.post(
  '/resend-verification',
  rateLimit(5, 15 * 60 * 1000),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;
      if (!email) {
        res.json({ success: true, data: { message: 'Si ce compte existe, un email a été envoyé.' } });
        return;
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || user.emailVerified !== false) {
        res.json({ success: true, data: { message: 'Si ce compte existe, un email a été envoyé.' } });
        return;
      }

      await prisma.emailToken.deleteMany({ where: { userId: user.id, type: 'verify' } });
      const token = crypto.randomBytes(32).toString('hex');
      await prisma.emailToken.create({
        data: { userId: user.id, token, type: 'verify', expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      });

      const verifyUrl = `${env.APP_URL}/verifier-email?token=${token}`;
      sendEmailVerification(user.email, user.firstName, verifyUrl).catch(() => {});

      res.json({ success: true, data: { message: 'Si ce compte existe, un email a été envoyé.' } });
    } catch (error) {
      next(error);
    }
  }
);

// POST /forgot-password
router.post(
  '/forgot-password',
  rateLimit(5, 15 * 60 * 1000),
  validate(forgotPasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });

      // Toujours répondre success pour éviter l'énumération d'emails
      if (!user) {
        return res.json({ success: true, data: { message: 'Si cet email existe, un lien vous a été envoyé.' } });
      }

      // Supprimer les anciens tokens de cet utilisateur
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

      // Créer un nouveau token (expire dans 1h)
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await prisma.passwordResetToken.create({
        data: { userId: user.id, token, expiresAt },
      });

      const resetUrl = `${env.APP_URL}/reinitialiser-mot-de-passe?token=${token}`;
      await sendPasswordResetEmail(user.email, user.firstName, resetUrl);

      res.json({ success: true, data: { message: 'Si cet email existe, un lien vous a été envoyé.' } });
    } catch (error) {
      next(error);
    }
  }
);

// POST /reset-password
router.post(
  '/reset-password',
  validate(resetPasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, password } = req.body;

      const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });

      if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
        throw new AppError('Ce lien est invalide ou a expiré.', 400);
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await prisma.$transaction([
        prisma.user.update({ where: { id: resetToken.userId }, data: { password: hashedPassword } }),
        prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { used: true } }),
      ]);

      // Invalidate auth cache so active sessions are forced to re-authenticate (BUG-044)
      invalidateAuthCache(resetToken.userId);

      res.json({ success: true, data: { message: 'Mot de passe réinitialisé avec succès.' } });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
