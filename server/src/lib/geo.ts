import prisma from './prisma.js';

// Géocodage via les API publiques françaises (gratuites, sans clé) :
// - geo.api.gouv.fr : communes (nom, code postal, code INSEE, centre GPS)
// - data.geopf.fr/geocodage : adresses (Base Adresse Nationale)
//
// Les coordonnées sont une donnée interne : elles sont calculées par le serveur à partir
// des adresses saisies et ne sont jamais demandées ni renvoyées aux utilisateurs.

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Suggestion affichée à l'utilisateur (sans coordonnées). */
export interface PlaceSuggestion {
  label: string;
  city: string;
  postalCode: string | null;
}

interface Commune extends Coordinates, PlaceSuggestion {}

const GEO_API = 'https://geo.api.gouv.fr/communes';
const ADDRESS_API = 'https://data.geopf.fr/geocodage/search';
const TIMEOUT_MS = 8000;
// En dessous de ce score, la Base Adresse Nationale renvoie souvent un lieu sans rapport
const MIN_ADDRESS_SCORE = 0.5;

// Une nouvelle tentative : les API publiques ont parfois des délais ponctuels
async function fetchJson(url: string, attempt = 1): Promise<any> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`Geo API ${res.status}`);
    return await res.json();
  } catch (e) {
    if (attempt < 2) return fetchJson(url, attempt + 1);
    throw e;
  }
}

function toCommune(c: any, postalCode?: string): Commune | null {
  const coords = c?.centre?.coordinates;
  if (!Array.isArray(coords)) return null;
  const cp = postalCode || (Array.isArray(c.codesPostaux) && c.codesPostaux.length === 1 ? c.codesPostaux[0] : null);
  return {
    label: cp ? `${c.nom} (${cp})` : `${c.nom} (${c.codeDepartement ?? ''})`.replace(' ()', ''),
    city: c.nom,
    postalCode: cp,
    latitude: coords[1],
    longitude: coords[0],
  };
}

async function findCommunes(query: string, limit = 6): Promise<Commune[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const fields = 'fields=nom,centre,codesPostaux,codeDepartement';
  const cpMatch = q.match(/^\d{5}$/);
  const url = cpMatch
    ? `${GEO_API}?codePostal=${q}&${fields}&limit=${limit}`
    : `${GEO_API}?nom=${encodeURIComponent(q)}&${fields}&boost=population&limit=${limit}`;
  const data = await fetchJson(url);
  if (!Array.isArray(data)) return [];
  return data
    .map((c: any) => toCommune(c, cpMatch ? q : undefined))
    .filter((c): c is Commune => c !== null);
}

/** Commune correspondant à un champ « ville » libre (ex : « 13006 Marseille », « Lyon »). */
async function findCommune(city: string): Promise<Commune | null> {
  const cp = city.match(/\b\d{5}\b/)?.[0];
  const name = city.replace(/\b\d{5}\b/, '').trim();
  if (name) {
    const results = await findCommunes(name, 5);
    const match = cp ? results.find((r) => r.postalCode === cp) ?? results[0] : results[0];
    if (match) return match;
  }
  if (cp) return (await findCommunes(cp, 1))[0] ?? null;
  return null;
}

/** Autocomplétion des communes (formulaires kooker). */
export async function suggestCities(query: string): Promise<PlaceSuggestion[]> {
  const communes = await findCommunes(query);
  return communes.map(({ label, city, postalCode }) => ({ label, city, postalCode }));
}

/** Autocomplétion d'adresses (lieu de la prestation, côté client). */
export async function suggestAddresses(query: string): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const data = await fetchJson(`${ADDRESS_API}?q=${encodeURIComponent(q)}&autocomplete=1&limit=6`);
  const features: any[] = Array.isArray(data?.features) ? data.features : [];
  return features.map((f) => ({
    label: f.properties?.label ?? '',
    city: f.properties?.city ?? '',
    postalCode: f.properties?.postcode ?? null,
  })).filter((p) => p.label);
}

// Petit cache mémoire : la même adresse est géocodée à chaque page de résultats
const addressCache = new Map<string, Coordinates | null>();
const CACHE_MAX = 500;

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/**
 * Coordonnées d'une adresse saisie (lieu de recherche du client, adresse d'un kooker).
 * `expectedCity` : le résultat doit se trouver dans cette commune (sinon null). On compare
 * le nom et non le code INSEE, car la BAN renvoie le code d'arrondissement pour
 * Paris, Lyon et Marseille.
 */
export async function geocodeAddress(address: string, expectedCity?: string): Promise<Coordinates | null> {
  const q = address.trim();
  if (q.length < 3) return null;
  const key = `${expectedCity ?? ''}|${q.toLowerCase()}`;
  if (addressCache.has(key)) return addressCache.get(key)!;

  const data = await fetchJson(`${ADDRESS_API}?q=${encodeURIComponent(q)}&limit=1`);
  const f = data?.features?.[0];
  const coords = f?.geometry?.coordinates;
  const sameCity = !expectedCity || normalize(f?.properties?.city ?? '') === normalize(expectedCity);
  const result = Array.isArray(coords) && sameCity && (f.properties?.score ?? 0) >= MIN_ADDRESS_SCORE
    ? { latitude: coords[1], longitude: coords[0] }
    : null;

  if (addressCache.size >= CACHE_MAX) addressCache.delete(addressCache.keys().next().value!);
  addressCache.set(key, result);
  return result;
}

/**
 * Coordonnées d'un kooker à partir de son adresse et de sa ville.
 * L'adresse est cherchée dans la commune du kooker ; si elle est absente ou introuvable,
 * on prend le centre de la commune.
 */
export async function geocodeKookerLocation(address: string | null | undefined, city: string | null | undefined): Promise<Coordinates | null> {
  if (!city?.trim()) return null;
  const commune = await findCommune(city);
  if (!commune) return null;
  if (address?.trim()) {
    const precise = await geocodeAddress(`${address} ${commune.postalCode ?? ''} ${commune.city}`, commune.city);
    if (precise) return precise;
  }
  return { latitude: commune.latitude, longitude: commune.longitude };
}

/**
 * Renseigne les coordonnées des profils kooker qui ont une ville mais pas encore
 * de coordonnées (profils créés avant la recherche par zone). Exécuté au démarrage.
 */
export async function backfillKookerCoordinates(): Promise<void> {
  const profiles = await prisma.kookerProfile.findMany({
    where: { latitude: null, city: { not: null } },
    select: { id: true, city: true, address: true },
  });
  for (const p of profiles) {
    try {
      const coords = await geocodeKookerLocation(p.address, p.city);
      if (coords) {
        await prisma.kookerProfile.update({ where: { id: p.id }, data: coords });
      }
    } catch (e) {
      console.error(`[geo] Géocodage impossible pour le kooker ${p.id} (${p.city}):`, e);
    }
  }
}
