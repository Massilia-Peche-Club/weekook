import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';

const SERVICE_PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=400&fit=crop',
];

const TYPE_LABELS: Record<string, string> = { COURS: 'Cours', KOOK: 'Repas' };
const TYPE_BG: Record<string, string> = {
  COURS: 'bg-[#c1a0fd] text-white',
  KOOK: 'bg-[#111125] text-white',
};

interface ServiceCardProps {
  id: number;
  title: string;
  type: string[];
  priceInCents: number;
  durationMinutes: number;
  cardImageUrl?: string | null;
  kooker: {
    id: number;
    name: string;
    avatarUrl?: string | null;
    city: string;
    rating: number;
    reviewCount: number;
  };
}

function toUrl(raw: string | null | undefined): string {
  if (!raw) return '';
  if (raw.startsWith('http') || raw.startsWith('/')) return raw;
  return `/uploads/${raw}`;
}

export default function ServiceCard({
  id,
  title,
  type,
  priceInCents,
  durationMinutes,
  cardImageUrl,
  kooker,
}: ServiceCardProps) {
  const badgeType = type?.[0] ?? 'KOOK';
  const price = priceInCents / 100;
  const h = Math.floor(durationMinutes / 60);
  const m = durationMinutes % 60;
  const durationLabel = h > 0 ? (m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`) : `${m}min`;
  const imageUrl = cardImageUrl || SERVICE_PLACEHOLDER_IMAGES[id % SERVICE_PLACEHOLDER_IMAGES.length];
  const avatarSrc = toUrl(kooker.avatarUrl);

  return (
    <Link
      to={`/prestation/${id}`}
      className="group block w-full max-w-[320px] sm:max-w-[286px] bg-white rounded-[20px] overflow-hidden shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Image */}
      <div className="p-3">
        <div className="relative w-full h-[200px] rounded-[16px] overflow-hidden bg-[#f2f4fc]">
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <span
            className={`absolute top-2 left-2 px-2.5 py-1 rounded-[8px] text-[11px] font-semibold ${TYPE_BG[badgeType] ?? TYPE_BG.KOOK}`}
          >
            {TYPE_LABELS[badgeType] ?? badgeType}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-4 space-y-2">
        <h3 className="font-semibold text-[15px] text-[#111125] line-clamp-1">{title}</h3>

        {/* Kooker */}
        <div className="flex items-center gap-2">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt={kooker.name}
              className="w-[32px] h-[32px] rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-[32px] h-[32px] rounded-full bg-[#e6d9fe] flex items-center justify-center flex-shrink-0">
              <span className="text-[12px] font-bold text-[#c1a0fd]">{kooker.name.charAt(0)}</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[#303044] truncate">{kooker.name}</p>
            <p className="text-[12px] text-[#9ca3af] truncate">{kooker.city}</p>
          </div>
        </div>

        {/* Rating */}
        {kooker.reviewCount > 0 && (
          <div className="flex items-center gap-1">
            <Star className="w-[14px] h-[14px] text-[#fbbf24] fill-[#fbbf24]" />
            <span className="text-[13px] font-medium text-[#111125]">{kooker.rating.toFixed(1)}</span>
            <span className="text-[12px] text-[#9ca3af]">({kooker.reviewCount} avis)</span>
          </div>
        )}

        {/* Price + Duration */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[16px] font-bold text-[#111125]">{price.toFixed(0)} €</span>
          <span className="text-[12px] text-[#9ca3af]">{durationLabel}</span>
        </div>
      </div>
    </Link>
  );
}
