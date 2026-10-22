import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Durée affichée uniquement pour les KOURS (désactivée pour les repas KOOK en MVP)
export function hasDuration(type: unknown, durationMinutes: number | null | undefined): boolean {
  if (!durationMinutes || durationMinutes <= 0) return false;
  let types: unknown = type;
  if (typeof types === 'string') {
    try { types = JSON.parse(types); } catch { /* string brute */ }
    if (typeof types === 'string') { try { types = JSON.parse(types); } catch { /* string brute */ } }
  }
  return Array.isArray(types) ? types.includes('COURS') : String(types).includes('COURS');
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
