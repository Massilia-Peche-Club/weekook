import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sendMessageSchema } from '../schemas/message.js';
import { AppError } from '../utils/errors.js';
import { sendNewMessageNotification } from '../lib/email.js';

const router = Router();

// GET /unread-count — Nombre total de messages non lus
router.get(
  '/unread-count',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const count = await prisma.message.count({
        where: { receiverId: userId, read: false },
      });
      res.json({ success: true, data: { count } });
    } catch (error) {
      next(error);
    }
  }
);

// GET /conversations — Liste des conversations avec dernier message et nb non lus
router.get(
  '/conversations',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;

      // Load recent messages only (last 500) to avoid loading entire history
      const messages = await prisma.message.findMany({
        where: {
          OR: [{ senderId: userId }, { receiverId: userId }],
        },
        select: {
          id: true,
          senderId: true,
          receiverId: true,
          content: true,
          read: true,
          kookerRecipientId: true,
          serviceId: true,
          createdAt: true,
          sender: {
            select: {
              id: true, firstName: true, lastName: true, avatar: true,
              kookerProfile: { select: { id: true } },
            },
          },
          receiver: {
            select: {
              id: true, firstName: true, lastName: true, avatar: true,
              kookerProfile: { select: { id: true } },
            },
          },
          service: {
            select: {
              id: true,
              title: true,
              type: true,
              priceInCents: true,
              images: { select: { url: true }, take: 1 },
              kookerProfile: {
                select: {
                  id: true,
                  user: { select: { firstName: true, lastName: true, avatar: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });

      // Group par partenaire + service (une conversation = un user + un service)
      const conversationMap = new Map<
        string,
        {
          user: { id: number; firstName: string; lastName: string; avatar: string | null; kookerProfileId: number | null };
          lastMessage: (typeof messages)[0];
          unreadCount: number;
          kookerRecipientId: number | null;
          service: (typeof messages)[0]['service'];
        }
      >();

      for (const msg of messages) {
        const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
        const partnerRaw = msg.senderId === userId ? msg.receiver : msg.sender;
        const partner = {
          id: partnerRaw.id,
          firstName: partnerRaw.firstName,
          lastName: partnerRaw.lastName,
          avatar: partnerRaw.avatar,
          kookerProfileId: (partnerRaw as any).kookerProfile?.id ?? null,
        };

        // Clé unique : partnerId + serviceId (un même user peut avoir plusieurs conversations si plusieurs prestations)
        const convKey = `${partnerId}-${msg.serviceId ?? 'none'}`;

        if (!conversationMap.has(convKey)) {
          conversationMap.set(convKey, {
            user: partner,
            lastMessage: msg,
            unreadCount: 0,
            kookerRecipientId: msg.kookerRecipientId ?? null,
            service: msg.service,
          });
        } else {
          const conv = conversationMap.get(convKey)!;
          if (!conv.kookerRecipientId && msg.kookerRecipientId) {
            conv.kookerRecipientId = msg.kookerRecipientId;
          }
        }

        if (msg.receiverId === userId && !msg.read) {
          conversationMap.get(convKey)!.unreadCount += 1;
        }
      }

      const conversations = Array.from(conversationMap.values()).sort(
        (a, b) =>
          new Date(b.lastMessage.createdAt).getTime() -
          new Date(a.lastMessage.createdAt).getTime()
      );

      res.json({ success: true, data: conversations });
    } catch (error) {
      next(error);
    }
  }
);

// GET /conversation/:userId — Messages avec un utilisateur, marque comme lus
// Query param ?serviceId=123 pour filtrer par prestation
router.get(
  '/conversation/:userId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const currentUserId = req.user!.userId;
      const otherUserId = parseInt(req.params.userId, 10);
      const serviceId = req.query.serviceId ? parseInt(req.query.serviceId as string, 10) : undefined;

      if (isNaN(otherUserId)) {
        throw new AppError('ID utilisateur invalide', 400);
      }

      const whereBase = {
        OR: [
          { senderId: currentUserId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: currentUserId },
        ],
        ...(serviceId ? { serviceId } : {}),
      };

      // Fetch messages and mark as read in parallel
      const [messages] = await Promise.all([
        prisma.message.findMany({
          where: whereBase,
          include: {
            sender: {
              select: { id: true, firstName: true, lastName: true, avatar: true },
            },
            receiver: {
              select: { id: true, firstName: true, lastName: true, avatar: true },
            },
            service: {
              select: {
                id: true,
                title: true,
                type: true,
                priceInCents: true,
                images: { select: { url: true }, take: 1 },
                kookerProfile: {
                  select: {
                    id: true,
                    user: { select: { firstName: true, lastName: true, avatar: true } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.message.updateMany({
          where: {
            senderId: otherUserId,
            receiverId: currentUserId,
            read: false,
            ...(serviceId ? { serviceId } : {}),
          },
          data: { read: true },
        }),
      ]);

      res.json({ success: true, data: messages });
    } catch (error) {
      next(error);
    }
  }
);

// POST / — Envoyer un message
router.post(
  '/',
  authenticate,
  validate(sendMessageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const senderId = req.user!.userId;
      const { receiverId, content, kookerRecipientId, serviceId } = req.body;

      if (senderId === receiverId) {
        throw new AppError('Vous ne pouvez pas vous envoyer un message a vous-meme', 400);
      }

      const receiver = await prisma.user.findUnique({
        where: { id: receiverId },
        select: { id: true, email: true, firstName: true, lastName: true },
      });

      if (!receiver) {
        throw new AppError('Destinataire non trouve', 404);
      }

      // Vérifier que le service existe (si fourni)
      if (serviceId) {
        const service = await prisma.service.findUnique({ where: { id: serviceId } });
        if (!service) {
          throw new AppError('Service introuvable', 404);
        }
      }

      const message = await prisma.message.create({
        data: {
          senderId,
          receiverId,
          content,
          serviceId,
          ...(kookerRecipientId ? { kookerRecipientId } : {}),
        },
        include: {
          sender: {
            select: { id: true, firstName: true, lastName: true, avatar: true },
          },
          receiver: {
            select: { id: true, firstName: true, lastName: true, avatar: true },
          },
        },
      });

      // Use sender data from the created message include (no extra query needed)
      const senderName = `${message.sender.firstName} ${message.sender.lastName}`.trim();
      const receiverName = `${receiver.firstName} ${receiver.lastName}`.trim();

      sendNewMessageNotification(
        receiverId,
        receiver.email,
        receiverName,
        senderName,
        content
      );

      res.status(201).json({ success: true, data: message });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /conversation/:userId — Supprimer la conversation avec un utilisateur
// Query param ?serviceId=123 pour supprimer uniquement la conversation liée à ce service
router.delete(
  '/conversation/:userId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const currentUserId = req.user!.userId;
      const otherUserId = parseInt(req.params.userId, 10);
      const serviceId = req.query.serviceId ? parseInt(req.query.serviceId as string, 10) : undefined;

      if (isNaN(otherUserId)) throw new AppError('ID invalide', 400);

      await prisma.message.deleteMany({
        where: {
          OR: [
            { senderId: currentUserId, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: currentUserId },
          ],
          ...(serviceId ? { serviceId } : {}),
        },
      });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /:id — Supprimer un message (expéditeur uniquement)
router.delete(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const messageId = parseInt(req.params.id, 10);

      if (isNaN(messageId)) throw new AppError('ID invalide', 400);

      const message = await prisma.message.findUnique({ where: { id: messageId } });
      if (!message) throw new AppError('Message introuvable', 404);
      if (message.senderId !== userId && message.receiverId !== userId) throw new AppError('Non autorisé', 403);

      await prisma.message.delete({ where: { id: messageId } });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
