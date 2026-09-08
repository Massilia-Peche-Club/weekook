import { z } from 'zod';

export const createBookingSchema = z.object({
  serviceId: z.number({ required_error: 'serviceId est requis' }),
  date: z.string({ required_error: 'La date est requise' }),
  startTime: z.string({ required_error: "L'heure de debut est requise" }),
  guests: z.number().optional().default(1),
  notes: z.string().optional(),
  ingredientsSource: z.enum(['client', 'kooker']).optional().default('client'),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(['confirmed', 'cancelled'], {
    required_error: 'Le statut est requis',
    invalid_type_error: 'Statut invalide',
  }),
});

export const updateBookingDetailsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)').optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format heure invalide (HH:MM)').optional(),
  guests: z.number().int().min(1).max(200).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;
export type UpdateBookingDetailsInput = z.infer<typeof updateBookingDetailsSchema>;
