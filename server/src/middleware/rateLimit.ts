import { Request, Response, NextFunction } from 'express';

// Chaque limiteur a son propre compteur par IP. (Un compteur unique partagé faisait que
// 5 connexions ratées bloquaient ensuite « Mot de passe oublié » pendant 15 min.)
export function rateLimit(maxRequests: number = 5, windowMs: number = 15 * 60 * 1000) {
  const requests = new Map<string, { count: number; resetTime: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = requests.get(ip);

    if (!record || now > record.resetTime) {
      requests.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Trop de requetes, veuillez reessayer plus tard',
      });
    }

    record.count++;
    next();
  };
}
