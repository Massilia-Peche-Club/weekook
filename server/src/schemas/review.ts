import { z } from 'zod';

export const createReviewSchema = z.object({
  kookerProfileId: z.number({ required_error: 'kookerProfileId est requis' }),
  bookingId: z.number({ required_error: 'bookingId est requis — un avis nécessite une réservation terminée' }),
  rating: z.number().min(1, 'La note minimum est 1').max(5, 'La note maximum est 5'),
  comment: z.string().optional(),
});

export const createKookerReviewSchema = z.object({
  bookingId: z.number({ required_error: 'bookingId est requis' }),
  rating: z.number().min(1, 'La note minimum est 1').max(5, 'La note maximum est 5'),
  comment: z.string().optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type CreateKookerReviewInput = z.infer<typeof createKookerReviewSchema>;
