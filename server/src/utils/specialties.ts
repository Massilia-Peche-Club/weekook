import prisma from '../lib/prisma.js';
import { AppError } from './errors.js';

function toList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') {
    try { return toList(JSON.parse(value)); } catch { return []; }
  }
  return [];
}

/**
 * Vérifie que les spécialités envoyées font partie de la liste gérée dans l'admin
 * (Configuration → specialties), pour que les filtres de recherche les retrouvent.
 * Les spécialités déjà enregistrées sur le profil ou l'offre (`existing`) restent
 * acceptées même si elles ne sont plus dans la liste : un kooker peut ainsi
 * sauvegarder sans devoir d'abord retirer une ancienne spécialité.
 */
export async function assertAllowedSpecialties(values: string[] | undefined, existing: unknown = []): Promise<void> {
  if (!values || values.length === 0) return;
  const config = await prisma.config.findUnique({ where: { key: 'specialties' } });
  const allowed = new Set([...toList(config?.value), ...toList(existing)]);
  const invalid = values.filter((v) => !allowed.has(v));
  if (invalid.length > 0) {
    throw new AppError(`Spécialité${invalid.length > 1 ? 's' : ''} non proposée${invalid.length > 1 ? 's' : ''} : ${invalid.join(', ')}. Choisissez dans la liste.`, 400);
  }
}
