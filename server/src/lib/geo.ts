import prisma from './prisma.js';

// Géocodage via les API publiques françaises (gratuites, sans clé) :
// - geo.api.gouv.fr : communes (nom, code postal, centre GPS)
// - data.geopf.fr/geocodage : adresses complètes (Base Adresse Nationale)

export interface GeoPlace {
  label: string;
  city: string;
  postalCode: string | null;
  latitude: number;
  longitude: number;
}

const GEO_API = 'https://geo.api.gouv.fr/communes';
const ADDRESS_API = 'https://data.geopf.fr/geocodage/search';
const TIMEOUT_MS = 5000;

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Geo API ${res.status}`);
  return res.json();
}

function communeToPlace(c: any, postalCode?: string): GeoPlace | null {
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

/** Recherche de communes par nom ou code postal (autocomplétion). */
export async function searchCities(query: string, limit = 6): Promise<GeoPlace[]> {
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
    .map((c: any) => communeToPlace(c, cpMatch ? q : undefined))
    .filter((p): p is GeoPlace => p !== null);
}

/** Commune correspondant à des coordonnées GPS. */
export async function reverseCity(latitude: number, longitude: number): Promise<GeoPlace | null> {
  const data = await fetchJson(`${GEO_API}?lat=${latitude}&lon=${longitude}&fields=nom,centre,codesPostaux,codeDepartement`);
  if (!Array.isArray(data) || data.length === 0) return null;
  const place = communeToPlace(data[0]);
  // On garde la position exacte de l'utilisateur plutôt que le centre de la commune
  return place ? { ...place, latitude, longitude } : null;
}

/** Géocodage d'une adresse complète (ex : adresse « chez moi » du client). */
export async function geocodeAddress(address: string): Promise<GeoPlace | null> {
  const q = address.trim();
  if (q.length < 3) return null;
  const data = await fetchJson(`${ADDRESS_API}?q=${encodeURIComponent(q)}&limit=1`);
  const f = data?.features?.[0];
  const coords = f?.geometry?.coordinates;
  if (!Array.isArray(coords)) return null;
  return {
    label: f.properties?.label ?? q,
    city: f.properties?.city ?? '',
    postalCode: f.properties?.postcode ?? null,
    latitude: coords[1],
    longitude: coords[0],
  };
}

/** Géocodage d'un champ « ville » libre (ex : « 13006 Marseille », « Lyon »). */
export async function geocodeCity(city: string): Promise<GeoPlace | null> {
  const cp = city.match(/\b\d{5}\b/)?.[0];
  const name = city.replace(/\b\d{5}\b/, '').trim();
  if (name) {
    const results = await searchCities(name, 5);
    const match = cp ? results.find((r) => r.postalCode === cp) ?? results[0] : results[0];
    if (match) return match;
  }
  if (cp) return (await searchCities(cp, 1))[0] ?? null;
  return null;
}

/**
 * Renseigne les coordonnées GPS des profils kooker qui ont une ville mais pas encore
 * de coordonnées (profils créés avant la recherche par zone). Exécuté au démarrage.
 */
export async function backfillKookerCoordinates(): Promise<void> {
  const profiles = await prisma.kookerProfile.findMany({
    where: { latitude: null, city: { not: null } },
    select: { id: true, city: true },
  });
  for (const p of profiles) {
    if (!p.city?.trim()) continue;
    try {
      const place = await geocodeCity(p.city);
      if (place) {
        await prisma.kookerProfile.update({
          where: { id: p.id },
          data: { latitude: place.latitude, longitude: place.longitude },
        });
      }
    } catch (e) {
      console.error(`[geo] Géocodage impossible pour le kooker ${p.id} (${p.city}):`, e);
    }
  }
}
