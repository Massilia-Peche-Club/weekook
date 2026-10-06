import { z } from 'zod';

export const sendMessageSchema = z.object({
  receiverId: z.number({ required_error: 'receiverId est requis' }),
  content: z.string().min(1, 'Le contenu du message est requis').max(2000, 'Le message ne peut pas dépasser 2000 caractères'),
  kookerRecipientId: z.number().optional(),
  serviceId: z.number().optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
