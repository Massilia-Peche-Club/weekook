import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Star, Clock, Users, ChevronLeft, X } from 'lucide-react';
import { api } from '@/lib/api';

// ─── Helpers ────────────────────────────────────────────────────────────────

function deepParse(val: unknown): unknown {
  if (typeof val !== 'string') return val;
  try { return deepParse(JSON.parse(val)); } catch { return val; }
}

function parseStringArr(val: unknown): string[] {
  const parsed = deepParse(val);
  if (Array.isArray(parsed)) return parsed.map(String);
  return [];
}

function toUrl(raw: string | null | undefined): string {
  if (!raw) return '';
  if (raw.startsWith('http') || raw.startsWith('/')) return raw;
  return `/uploads/${raw}`;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
  return `${m} min`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ServiceImage {
  id: number;
  url: string;
  alt: string | null;
  sortOrder: number;
  isCardImage: boolean;
}

interface MenuItem {
  id: number;
  category: string;
  name: string;
  description: string | null;
  sortOrder: number;
}

interface KookerProfile {
  id: number;
  city: string;
  rating: number;
  reviewCount: number;
  bio: string | null;
  specialties: unknown;
  experience: string | null;
  featured: boolean;
  verified: boolean;
  user: { id: number; firstName: string; lastName: string; avatar: string | null };
}

interface ServiceDetail {
  id: number;
  title: string;
  description: string | null;
  type: unknown;
  priceInCents: number;
  extraGuestPriceInCents: number | null;
  durationMinutes: number;
  minGuests: number | null;
  maxGuests: number;
  allergens: unknown;
  constraints: unknown;
  specialty: unknown;
  koursDifficulty: string | null;
  koursLocation: string | null;
  equipmentProvided: boolean;
  ingredientsIncluded: boolean;
  equipmentKooker: string | null;
  ingredientsList: unknown;
  ingredientsBaseServings: number | null;
  images: ServiceImage[];
  menuItems: MenuItem[];
  kookerProfile: KookerProfile;
}

const TYPE_LABELS: Record<string, string> = { COURS: 'Cours', KOOK: 'Repas à domicile' };
const TYPE_BG: Record<string, string> = {
  COURS: 'bg-[#c1a0fd] text-white',
  KOOK: 'bg-[#111125] text-white',
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [service, setService] = useState<ServiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    api.get<ServiceDetail>(`/services/${id}`)
      .then((res) => {
        if (res.success && res.data) {
          setService(res.data);
        } else {
          setError(res.error || 'Prestation introuvable');
        }
      })
      .catch(() => setError('Erreur lors du chargement'))
      .finally(() => setIsLoading(false));
  }, [id]);

  useEffect(() => {
    if (service) document.title = `${service.title} — Weekook`;
    return () => { document.title = 'Weekook'; };
  }, [service]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f2f4fc] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#c1a0fd] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="min-h-screen bg-[#f2f4fc] flex flex-col items-center justify-center gap-4">
        <p className="text-[16px] text-[#6b7280]">{error || 'Prestation introuvable'}</p>
        <button
          onClick={() => navigate('/recherche')}
          className="px-6 py-3 bg-[#c1a0fd] text-white rounded-[12px] font-semibold hover:bg-[#b090ed] transition-colors"
        >
          Retour à la recherche
        </button>
      </div>
    );
  }

  // Parsed fields
  const types = parseStringArr(service.type);
  const badgeType = types[0] ?? 'KOOK';
  const allergens = parseStringArr(service.allergens);
  const specialties = parseStringArr(service.kookerProfile.specialties);
  const rawIngredients = deepParse(service.ingredientsList);
  const ingredients = Array.isArray(rawIngredients)
    ? (rawIngredients as { name: string; quantity: string; unit: string }[])
    : [];

  const price = service.priceInCents / 100;
  const extraPrice = service.extraGuestPriceInCents ? service.extraGuestPriceInCents / 100 : null;
  const images = service.images;
  const kooker = service.kookerProfile;
  const kookerName = `${kooker.user.firstName} ${kooker.user.lastName}`;
  const kookerAvatarSrc = toUrl(kooker.user.avatar);
  const menuByCategory = service.menuItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#f2f4fc]">
      <div className="px-4 md:px-8 lg:px-[96px] py-6 md:py-8">

        {/* Breadcrumb */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-[14px] text-[#6b7280] hover:text-[#111125] transition-colors mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Retour
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

          {/* ── Main column ─────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Header */}
            <div className="bg-white rounded-[20px] p-6 shadow-sm">
              <div className="flex flex-wrap items-start gap-3 mb-3">
                <span className={`px-3 py-1 rounded-[8px] text-[12px] font-semibold ${TYPE_BG[badgeType] ?? TYPE_BG.KOOK}`}>
                  {TYPE_LABELS[badgeType] ?? badgeType}
                </span>
                {kooker.verified && (
                  <span className="px-3 py-1 rounded-[8px] text-[12px] font-semibold bg-[#ecfdf5] text-[#059669]">
                    Kooker vérifié
                  </span>
                )}
              </div>
              <h1 className="text-[24px] md:text-[28px] font-bold text-[#111125] mb-2">{service.title}</h1>
              {allergens.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-[13px] text-[#9ca3af]">Allergènes :</span>
                  {allergens.map((a) => (
                    <span key={a} className="px-2.5 py-1 bg-[#fff7ed] border border-[#fed7aa] text-[#c2410c] rounded-[8px] text-[12px] font-medium">
                      {a}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Gallery */}
            {images.length > 0 && (
              <div className="bg-white rounded-[20px] p-4 shadow-sm">
                <div className={`grid gap-3 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {images.map((img, i) => (
                    <button
                      key={img.id}
                      onClick={() => setLightboxIndex(i)}
                      className={`relative overflow-hidden rounded-[12px] bg-[#f2f4fc] cursor-pointer ${images.length === 1 ? 'h-[280px] md:h-[360px]' : 'h-[180px] md:h-[240px]'}`}
                    >
                      <img
                        src={toUrl(img.url)}
                        alt={img.alt || service.title}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {service.description && (
              <div className="bg-white rounded-[20px] p-6 shadow-sm">
                <h2 className="text-[18px] font-semibold text-[#111125] mb-3">Description</h2>
                <p className="text-[15px] text-[#5c5c6f] leading-relaxed whitespace-pre-line">{service.description}</p>
              </div>
            )}

            {/* Details */}
            <div className="bg-white rounded-[20px] p-6 shadow-sm">
              <h2 className="text-[18px] font-semibold text-[#111125] mb-4">Informations pratiques</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-[40px] h-[40px] rounded-full bg-[#f3ecff] flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-[#c1a0fd]" />
                  </div>
                  <div>
                    <p className="text-[12px] text-[#9ca3af]">Durée</p>
                    <p className="text-[14px] font-medium text-[#111125]">{formatDuration(service.durationMinutes)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-[40px] h-[40px] rounded-full bg-[#f3ecff] flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-[#c1a0fd]" />
                  </div>
                  <div>
                    <p className="text-[12px] text-[#9ca3af]">Convives</p>
                    <p className="text-[14px] font-medium text-[#111125]">
                      {service.minGuests ? `${service.minGuests} – ` : ''}{service.maxGuests} personnes
                    </p>
                  </div>
                </div>
                {service.koursDifficulty && (
                  <div className="flex items-center gap-3">
                    <div className="w-[40px] h-[40px] rounded-full bg-[#f3ecff] flex items-center justify-center flex-shrink-0">
                      <span className="text-[18px]">🎓</span>
                    </div>
                    <div>
                      <p className="text-[12px] text-[#9ca3af]">Niveau</p>
                      <p className="text-[14px] font-medium text-[#111125]">{service.koursDifficulty}</p>
                    </div>
                  </div>
                )}
                {service.koursLocation && (
                  <div className="flex items-center gap-3">
                    <div className="w-[40px] h-[40px] rounded-full bg-[#f3ecff] flex items-center justify-center flex-shrink-0">
                      <span className="text-[18px]">📍</span>
                    </div>
                    <div>
                      <p className="text-[12px] text-[#9ca3af]">Lieu</p>
                      <p className="text-[14px] font-medium text-[#111125]">{service.koursLocation}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-[40px] h-[40px] rounded-full bg-[#f3ecff] flex items-center justify-center flex-shrink-0">
                    <span className="text-[18px]">{service.equipmentProvided ? '✅' : '❌'}</span>
                  </div>
                  <div>
                    <p className="text-[12px] text-[#9ca3af]">Matériel</p>
                    <p className="text-[14px] font-medium text-[#111125]">
                      {service.equipmentProvided ? 'Fourni par le kooker' : 'Non fourni'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-[40px] h-[40px] rounded-full bg-[#f3ecff] flex items-center justify-center flex-shrink-0">
                    <span className="text-[18px]">{service.ingredientsIncluded ? '✅' : '❌'}</span>
                  </div>
                  <div>
                    <p className="text-[12px] text-[#9ca3af]">Ingrédients</p>
                    <p className="text-[14px] font-medium text-[#111125]">
                      {service.ingredientsIncluded ? 'Inclus' : 'À apporter par le client'}
                    </p>
                  </div>
                </div>
              </div>
              {service.equipmentKooker && (
                <div className="mt-4 pt-4 border-t border-[#f0f0f0]">
                  <p className="text-[13px] font-medium text-[#303044] mb-1">Matériel du kooker :</p>
                  <p className="text-[14px] text-[#5c5c6f]">{service.equipmentKooker}</p>
                </div>
              )}
              {!!service.constraints && String(service.constraints) !== 'null' && (
                <div className="mt-4 pt-4 border-t border-[#f0f0f0]">
                  <p className="text-[13px] font-medium text-[#303044] mb-1">Contraintes :</p>
                  <p className="text-[14px] text-[#5c5c6f]">{String(service.constraints)}</p>
                </div>
              )}
            </div>

            {/* Ingredients */}
            {ingredients.length > 0 && (
              <div className="bg-white rounded-[20px] p-6 shadow-sm">
                <h2 className="text-[18px] font-semibold text-[#111125] mb-1">Ingrédients</h2>
                {service.ingredientsBaseServings && (
                  <p className="text-[13px] text-[#9ca3af] mb-4">Pour {service.ingredientsBaseServings} personnes</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ingredients.map((ing, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-[#f0f0f0] last:border-0">
                      <span className="text-[14px] text-[#303044]">{ing.name}</span>
                      <span className="text-[14px] font-medium text-[#111125] ml-4 whitespace-nowrap">
                        {ing.quantity} {ing.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Menu items */}
            {Object.keys(menuByCategory).length > 0 && (
              <div className="bg-white rounded-[20px] p-6 shadow-sm">
                <h2 className="text-[18px] font-semibold text-[#111125] mb-4">Menu</h2>
                {Object.entries(menuByCategory).map(([category, items]) => (
                  <div key={category} className="mb-5 last:mb-0">
                    <h3 className="text-[14px] font-semibold text-[#c1a0fd] uppercase tracking-wide mb-2">{category}</h3>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div key={item.id}>
                          <p className="text-[14px] font-medium text-[#303044]">{item.name}</p>
                          {item.description && <p className="text-[13px] text-[#9ca3af]">{item.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Sidebar ─────────────────────────────────────────────── */}
          <div className="space-y-6">

            {/* Price card + CTA */}
            <div className="bg-white rounded-[20px] p-6 shadow-sm sticky top-4">
              <p className="text-[13px] text-[#9ca3af] mb-1">Forfait</p>
              <p className="text-[32px] font-bold text-[#111125] mb-1">{price.toFixed(0)} €</p>
              {extraPrice && (
                <p className="text-[13px] text-[#6b7280] mb-4">
                  + {extraPrice.toFixed(0)} € / convive supplémentaire
                </p>
              )}
              <Link
                to={`/reservation?service=${service.id}&kooker=${kooker.id}`}
                className="block w-full text-center py-3.5 bg-[#c1a0fd] hover:bg-[#b090ed] text-white font-semibold text-[15px] rounded-[12px] transition-colors mt-4"
              >
                Réserver cette prestation
              </Link>
              <p className="text-[12px] text-[#9ca3af] text-center mt-3">Aucun paiement prélevé maintenant</p>
            </div>

            {/* Kooker encart */}
            <div className="bg-white rounded-[20px] p-6 shadow-sm">
              <h2 className="text-[15px] font-semibold text-[#111125] mb-4">Votre kooker</h2>
              <div className="flex items-center gap-3 mb-4">
                {kookerAvatarSrc ? (
                  <img src={kookerAvatarSrc} alt={kookerName} className="w-[56px] h-[56px] rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-[56px] h-[56px] rounded-full bg-[#e6d9fe] flex items-center justify-center flex-shrink-0">
                    <span className="text-[20px] font-bold text-[#c1a0fd]">{kookerName.charAt(0)}</span>
                  </div>
                )}
                <div>
                  <p className="text-[16px] font-semibold text-[#111125]">{kookerName}</p>
                  <p className="text-[13px] text-[#9ca3af]">{kooker.city}</p>
                </div>
              </div>

              {kooker.reviewCount > 0 && (
                <div className="flex items-center gap-1.5 mb-3">
                  {Array.from({ length: Math.round(kooker.rating) }).map((_, i) => (
                    <Star key={i} className="w-[14px] h-[14px] text-[#fbbf24] fill-[#fbbf24]" />
                  ))}
                  <span className="text-[13px] font-medium text-[#111125]">{kooker.rating.toFixed(1)}</span>
                  <span className="text-[12px] text-[#9ca3af]">({kooker.reviewCount} avis)</span>
                </div>
              )}

              {kooker.bio && (
                <p className="text-[13px] text-[#5c5c6f] leading-relaxed mb-3 line-clamp-3">{kooker.bio}</p>
              )}

              {kooker.experience && (
                <p className="text-[12px] text-[#9ca3af] mb-3">Expérience : {kooker.experience}</p>
              )}

              {specialties.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {specialties.slice(0, 4).map((s) => (
                    <span key={s} className="px-2.5 py-1 bg-[#f3ecff] text-[#c1a0fd] rounded-[8px] text-[11px] font-medium">
                      {s}
                    </span>
                  ))}
                </div>
              )}

              <Link
                to={`/kooker/${kooker.id}`}
                className="block w-full text-center py-2.5 border-2 border-[#c1a0fd] text-[#c1a0fd] hover:bg-[#f3ecff] text-[14px] font-semibold rounded-[12px] transition-colors"
              >
                Voir son profil
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            onClick={() => setLightboxIndex(null)}
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={toUrl(images[lightboxIndex].url)}
            alt={images[lightboxIndex].alt || service.title}
            className="max-w-full max-h-[90vh] rounded-[12px] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
