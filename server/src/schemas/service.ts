import { z } from 'zod';

const menuItemSchema = z.object({
  category: z.string(),
  name: z.string(),
  description: z.string().optional(),
});

const ingredientItemSchema = z.object({
  name: z.string(),
  quantity: z.string(),
  unit: z.string(),
});

// Normalize legacy 'KOURS' → 'COURS'
const normalizeTypes = (types: string[]) => types.map((t) => (t === 'KOURS' ? 'COURS' : t));

// Une prestation a exactement un type : un repas (KOOK) OU un cours (COURS).
// Le formulaire crée une prestation distincte par type ; une prestation à double type
// ressortait dans les deux filtres de recherche avec un seul badge.
const serviceType = z
  .array(z.string())
  .transform(normalizeTypes)
  .refine((t) => t.length === 1 && (t[0] === 'KOOK' || t[0] === 'COURS'), {
    message: 'Une prestation doit avoir un seul type : KOOK ou COURS',
  });

export const createServiceSchema = z.object({
  title: z.string().trim().min(1, 'Le titre est requis'),
  description: z.string().optional(),
  type: serviceType,
  priceInCents: z.number().min(0, 'Le prix doit etre positif'),
  durationMinutes: z.number().min(0), // 0 pour les KOOK (durée désactivée en MVP)
  minGuests: z.number().int().min(1).optional(),
  maxGuests: z.number().int().min(1, 'Le nombre de convives doit être au moins 1').optional().default(1),
  allergens: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  specialty: z.array(z.string()).optional(),
  prepTimeMinutes: z.number().optional(),
  ingredientsIncluded: z.boolean().optional(),
  equipmentProvided: z.boolean().optional(),
  ingredientsList: z.array(ingredientItemSchema).optional(),
  ingredientsBaseServings: z.number().int().min(1).optional(),
  ingredientsPricePerGuestInCents: z.number().int().min(0).optional(),
  ingredientsDefaultSource: z.enum(['client', 'kooker']).optional(),
  equipmentKooker: z.array(z.string()).optional(),
  extraGuestPriceInCents: z.number().min(0).optional(),
  koursDifficulty: z.string().optional(),
  koursLocation: z.string().optional(),
  menuItems: z.array(menuItemSchema).optional(),
  images: z.array(z.string()).optional(),
}).refine(
  (d) => d.minGuests == null || d.maxGuests == null || d.minGuests <= d.maxGuests,
  { message: 'Le nombre minimum de convives ne peut pas dépasser le maximum', path: ['minGuests'] }
);

export const updateServiceSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  type: serviceType.optional(),
  priceInCents: z.number().min(0).optional(),
  durationMinutes: z.number().min(0).optional(),
  minGuests: z.number().optional(),
  maxGuests: z.number().optional(),
  active: z.boolean().optional(),
  allergens: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  specialty: z.array(z.string()).optional(),
  prepTimeMinutes: z.number().optional(),
  ingredientsIncluded: z.boolean().optional(),
  equipmentProvided: z.boolean().optional(),
  ingredientsList: z.array(ingredientItemSchema).optional(),
  ingredientsBaseServings: z.number().int().min(1).optional(),
  ingredientsPricePerGuestInCents: z.number().int().min(0).nullable().optional(),
  ingredientsDefaultSource: z.enum(['client', 'kooker']).optional(),
  equipmentKooker: z.array(z.string()).optional(),
  extraGuestPriceInCents: z.number().min(0).optional(),
  koursDifficulty: z.string().optional(),
  koursLocation: z.string().optional(),
  menuItems: z.array(menuItemSchema).optional(),
  images: z.array(z.string()).optional(),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
