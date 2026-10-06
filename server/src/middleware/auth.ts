import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { verifyToken, signToken, INACTIVITY_TIMEOUT_MS, TOKEN_REFRESH_THRESHOLD_S } from '../utils/jwt.js';
import { UnauthorizedError } from '../utils/errors.js';
import { env } from '../config/env.js';

// In-memory user cache (TTL 60s) — avoids 1 DB query per authenticated request
const AUTH_CACHE_TTL = 60_000;
const authCache = new Map<number, { data: { userId: number; email: string; role: string; isAdmin: boolean; kookerProfileId: number | null }; expiresAt: number }>();

/** Invalidate a user's auth cache (call after role/profile changes) */
export function invalidateAuthCache(userId: number): void {
  authCache.delete(userId);
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        email: string;
        role: string;
        isAdmin: boolean;
        kookerProfileId?: number | null;
      };
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.token;
    if (!token) {
      throw new UnauthorizedError('Token manquant');
    }

    const payload = verifyToken(token);
    const now = Date.now();
    const nowSec = Math.floor(now / 1000);

    // ── Sliding session: reset inactivity timeout on every authenticated request ──
    const cookieOpts = {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: INACTIVITY_TIMEOUT_MS, // 2h from now
      path: '/',
    };

    // If token was issued more than 1h ago, sign a fresh token (extends absolute session)
    const tokenAge = payload.iat ? nowSec - payload.iat : 0;
    if (tokenAge > TOKEN_REFRESH_THRESHOLD_S) {
      const freshToken = signToken({ userId: payload.userId, email: payload.email });
      res.cookie('token', freshToken, cookieOpts);
    } else {
      // Just refresh the cookie expiry (same token, reset 2h inactivity timer)
      res.cookie('token', token, cookieOpts);
    }

    // Check cache first
    const cached = authCache.get(payload.userId);
    if (cached && cached.expiresAt > now) {
      req.user = cached.data;
      return next();
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, isAdmin: true, kookerProfile: { select: { id: true } } },
    });

    if (!user) {
      throw new UnauthorizedError('Utilisateur non trouve');
    }

    if (user.role === 'suspended') {
      throw new UnauthorizedError('Votre compte a été suspendu. Contactez le support.');
    }

    const userData = {
      userId: user.id,
      email: user.email,
      role: user.role,
      isAdmin: user.isAdmin,
      kookerProfileId: user.kookerProfile?.id || null,
    };

    // Store in cache
    authCache.set(payload.userId, { data: userData, expiresAt: now + AUTH_CACHE_TTL });

    req.user = userData;
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
    } else {
      next(new UnauthorizedError('Token invalide'));
    }
  }
}

export function requireKooker(req: Request, _res: Response, next: NextFunction) {
  if (!req.user?.kookerProfileId) {
    return next(new UnauthorizedError('Acces reserve aux kookers'));
  }
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) {
    return next(new UnauthorizedError('Acces reserve aux administrateurs'));
  }
  next();
}
