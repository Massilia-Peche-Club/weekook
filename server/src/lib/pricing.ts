import prisma from './prisma.js';

const DEFAULT_BASE_GUESTS = 6;

/**
 * Nombre de personnes incluses dans le forfait (KOOK et COURS) : `minGuests` de l'offre
 * s'il est renseigné, sinon la valeur `kookBaseGuests` de la configuration admin (défaut 6).
 * Même règle que la page de réservation (client/src/pages/BookingPage.tsx).
 */
export async function getForfaitGuests(minGuests: number | null | undefined): Promise<number> {
  if (minGuests && minGuests > 0) return minGuests;
  const config = await prisma.config.findUnique({ where: { key: 'kookBaseGuests' } });
  const value = config ? Number(JSON.parse(config.value)) : NaN;
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_BASE_GUESTS;
}

/** Prix total : forfait + supplément par personne au-delà du forfait + ingrédients éventuels. */
export async function computeBookingPrice(
  service: {
    priceInCents: number;
    extraGuestPriceInCents: number | null;
    minGuests: number | null;
    ingredientsPricePerGuestInCents?: number | null;
  },
  guests: number,
  ingredientsSource?: string | null,
): Promise<number> {
  const forfaitGuests = await getForfaitGuests(service.minGuests);
  let total = service.priceInCents + Math.max(0, guests - forfaitGuests) * (service.extraGuestPriceInCents ?? 0);
  if (ingredientsSource === 'kooker' && service.ingredientsPricePerGuestInCents) {
    total += service.ingredientsPricePerGuestInCents * guests;
  }
  return total;
}
