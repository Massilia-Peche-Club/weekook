import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { createContactMessageSchema } from '../schemas/contact.js';

const router = Router();

// POST / - Envoyer un message via le formulaire de contact (public)
router.post(
  '/',
  rateLimit(5, 15 * 60 * 1000),
  validate(createContactMessageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, subject, message } = req.body;
      await prisma.contactMessage.create({
        data: { name, email, subject: subject || null, message },
      });
      res.status(201).json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
