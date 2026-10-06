import { z } from 'zod';

const phoneSchema = z.string().regex(/^[+\d\s\-().]{7,20}$/, 'Format de téléphone invalide').optional();

export const becomeKookerSchema = z.object({
  bio: z.string().optional(),
  specialties: z.array(z.string()),
  type: z.array(z.string()),
  city: z.string().min(1, 'La ville est requise'),
  experience: z.string().optional(),
  isCompany: z.boolean().optional(),
  phone: phoneSchema,
});

export const updateKookerProfileSchema = z.object({
  bio: z.string().optional(),
  specialties: z.array(z.string()).optional(),
  type: z.array(z.string()).optional(),
  city: z.string().optional(),
  experience: z.string().optional(),
  address: z.string().optional(),
  isCompany: z.boolean().optional(),
});

export const updateUserProfileSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  phone: phoneSchema,
  email: z.string().email('Email invalide').optional(),
});

export const updateHostingProfileSchema = z.object({
  address:             z.string().optional(),
  addressComplement:   z.string().optional(),
  city:                z.string().optional(),
  postalCode:          z.string().optional(),
  country:             z.string().optional(),
  accessCode:          z.string().optional(),
  floor:               z.string().optional(),
  intercom:            z.string().optional(),
  parkingInfo:         z.string().optional(),
  stoveType:           z.enum(['gaz', 'induction', 'électrique', 'mixte']).optional(),
  hasOven:             z.boolean().optional(),
  hasDishwasher:       z.boolean().optional(),
  tableCapacity:       z.number().int().min(1).max(100).optional(),
  kitchenNotes:        z.string().optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  allergies:           z.array(z.string()).optional(),
  hostingNotes:        z.string().optional(),
});

export type BecomeKookerInput = z.infer<typeof becomeKookerSchema>;
export type UpdateKookerProfileInput = z.infer<typeof updateKookerProfileSchema>;
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
export type UpdateHostingProfileInput = z.infer<typeof updateHostingProfileSchema>;
