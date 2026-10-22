import { z } from 'zod';

export const createContactMessageSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis').max(100),
  email: z.string().trim().email('Email invalide').max(255),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1, 'Le message est requis').max(5000, 'Le message ne peut pas dépasser 5000 caractères'),
});

export type CreateContactMessageInput = z.infer<typeof createContactMessageSchema>;
