import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { usePageTiming } from '@/hooks/usePageTiming';
import { compressImage } from '@/lib/compressImage';

// ────────────────────────── Types ──────────────────────────
interface Booking {
  id: number;
  serviceName: string;
  serviceType: string;
  kookerProfileId: number;
  kookerName: string;
  kookerAvatar: string;
  date: string;
  time: string;
  guests: number;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed' | 'awaiting_confirmation';
  totalPrice: number;
}

interface FavoriteKooker {
  id: number;
  name: string;
  avatar: string;
  specialty: string;
  city: string;
  rating: number;
  reviewCount: number;
  priceFrom: number;
}

// ────────────────────────── API Response Types ──────────────────────────
interface ApiBooking {
  id: number;
  date: string;
  startTime: string;
  guests: number;
  totalPriceInCents: number;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed' | 'awaiting_confirmation';
  notes?: string;
  service: {
    id: number;
    title: string;
    type: string;
  };
  kookerProfile: {
    id: number;
    city: string;
    user: {
      firstName: string;
      lastName: string;
      avatar: string | null;
    };
  };
  reviews?: { id: number }[];
}

interface ApiFavorite {
  id: number;
  kookerProfile: {
    id: number;
    city: string;
    specialties: string;
    rating: number;
    reviewCount: number;
    user: {
      firstName: string;
      lastName: string;
      avatar: string | null;
    };
    services: { priceInCents: number }[];
  };
}

// ────────────────────────── Helper Components ──────────────────────────

const StatusBadge = ({ status }: { status: Booking['status'] }) => {
  const config = {
    confirmed: { label: 'confirmé', bg: 'bg-[#e8f5e9]', text: 'text-green-600' },
    pending: { label: 'en attente', bg: 'bg-[#fff3e0]', text: 'text-orange-600' },
    cancelled: { label: 'annulé', bg: 'bg-red-50', text: 'text-red-600' },
    completed: { label: 'terminé', bg: 'bg-[#f5f5f5]', text: 'text-[#828294]' },
    awaiting_confirmation: { label: 'À confirmer', bg: 'bg-[#fef3c7]', text: 'text-[#d97706]' },
  };
  const s = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-[14px] font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
};

const formatPrice = (cents: number) => {
  return (cents / 100).toFixed(2).replace('.', ',') + ' EUR';
};

// ────────────────────────── Booking Card ──────────────────────────

const BookingCard = ({ booking, showActions = false, onCancel, onViewDetails, onReview, hasReview, onConfirmCompletion }: { booking: Booking; showActions?: boolean; onCancel?: (id: number) => void; onViewDetails?: (id: number) => void; onReview?: (booking: Booking) => void; hasReview?: boolean; onConfirmCompletion?: (id: number) => void }) => {
  const isKours = Array.isArray(booking.serviceType)
    ? (booking.serviceType as unknown as string[]).includes('COURS')
    : String(booking.serviceType || '').includes('COURS');
  const isKook = !isKours && String(booking.serviceType || '').includes('KOOK');

  return (
  <div className="bg-white rounded-[20px] p-6 shadow-sm">
    {/* Top row: service name + kooker + status badge */}
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
      <div className="flex gap-4 flex-1 min-w-0">
        {/* Kooker Avatar */}
        <div className="w-12 h-12 rounded-full bg-[#c1a0fd]/20 flex items-center justify-center flex-shrink-0">
          {booking.kookerAvatar ? (
            <img src={booking.kookerAvatar} alt={booking.kookerName} className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <span className="text-[#c1a0fd] font-bold text-[14px]">
              {booking.kookerName.split(' ').map(n => n[0]).join('')}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <h4 className="text-[20px] font-semibold text-[#111125] truncate">{booking.serviceName}</h4>
            {isKours && <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-bold bg-[#c1a0fd] text-white">COURS</span>}
            {isKook && <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-bold bg-[#7c5cbf] text-white">KOOK</span>}
          </div>
          <p className="text-[16px] text-[#5c5c6f]">par {booking.kookerName}</p>
        </div>
      </div>
      <StatusBadge status={booking.status} />
    </div>

    {/* Info grid: date / time / guests */}
    <div className="grid grid-cols-3 gap-4 mb-4">
      <div className="flex items-center gap-2 text-[14px] text-[#5c5c6f]">
        <svg width="16" height="16" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
          <rect x="1.75" y="2.33337" width="10.5" height="10.5" rx="1.5" stroke="currentColor" strokeWidth="1.1"/>
          <path d="M1.75 5.83337H12.25" stroke="currentColor" strokeWidth="1.1"/>
          <path d="M4.66667 1.16663V3.49996" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          <path d="M9.33333 1.16663V3.49996" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
        </svg>
        <span className="truncate">{formatDate(booking.date)}</span>
      </div>
      <div className="flex items-center gap-2 text-[14px] text-[#5c5c6f]">
        <svg width="16" height="16" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
          <circle cx="7" cy="7" r="5.25" stroke="currentColor" strokeWidth="1.1"/>
          <path d="M7 4.08337V7.00004L8.75 8.75004" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
        </svg>
        <span>{booking.time}</span>
      </div>
      <div className="flex items-center gap-2 text-[14px] text-[#5c5c6f]">
        <svg width="16" height="16" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
          <path d="M9.91667 12.25V11.0833C9.91667 10.4645 9.67083 9.871 9.23325 9.43342C8.79567 8.99583 8.20217 8.75 7.58333 8.75H3.5C2.88116 8.75 2.28767 8.99583 1.85008 9.43342C1.4125 9.871 1.16667 10.4645 1.16667 11.0833V12.25" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          <circle cx="5.54167" cy="4.08333" r="2.33333" stroke="currentColor" strokeWidth="1.1"/>
          <path d="M12.8333 12.25V11.0833C12.8333 10.0833 12.1667 9.25 11.375 8.91667" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          <path d="M9.625 1.91663C10.4167 2.24996 11.0833 3.08329 11.0833 4.08329C11.0833 5.08329 10.4167 5.91663 9.625 6.24996" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
        </svg>
        <span>{booking.guests} {isKours ? 'participant' : 'convive'}{booking.guests > 1 ? 's' : ''}</span>
      </div>
    </div>

    {/* Bottom separator: price left, actions right */}
    <div className="border-t border-[#e0e2ef] pt-4 flex flex-row items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="#111125" strokeWidth="1.2"/>
          <path d="M1.5 6.5H14.5" stroke="#111125" strokeWidth="1.2"/>
        </svg>
        <p className="text-[18px] font-bold text-[#111125]">{formatPrice(booking.totalPrice)}</p>
      </div>
      <div className="flex gap-2">
        {showActions && booking.status !== 'cancelled' && booking.status !== 'completed' && (
          <>
            <button
              onClick={() => onViewDetails?.(booking.id)}
              className="px-4 py-2 bg-[#c1a0fd] hover:bg-[#b090ed] text-white text-[14px] font-medium rounded-[8px] transition-all"
            >
              Voir les détails
            </button>
            <button
              onClick={() => onCancel?.(booking.id)}
              className="px-4 py-2 border border-[#c1a0fd] text-[#c1a0fd] text-[14px] font-medium rounded-[8px] hover:bg-[#f3ecff] transition-all"
            >
              Annuler
            </button>
          </>
        )}
        {booking.status === 'completed' && (
          hasReview
            ? <span className="px-4 py-2 text-[14px] font-medium text-green-600 flex items-center gap-1.5">✓ Avis laissé</span>
            : <button onClick={() => onReview?.(booking)} className="px-4 py-2 bg-[#c1a0fd] hover:bg-[#b090ed] text-white text-[14px] font-medium rounded-[8px] transition-all">
                Laisser un avis
              </button>
        )}
        {booking.status === 'awaiting_confirmation' && (
          <button
            onClick={() => onConfirmCompletion?.(booking.id)}
            className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white text-[14px] font-medium rounded-[8px] transition-all"
          >
            Confirmer la réalisation
          </button>
        )}
      </div>
    </div>
  </div>
  );
};

// ────────────────────────── Favorite Card ──────────────────────────

const FavoriteKookerCard = ({ kooker, onRemove }: { kooker: FavoriteKooker; onRemove: (id: number) => void }) => (
  <Link to={`/kooker/${kooker.id}`} className="bg-white rounded-[20px] p-6 shadow-sm block hover:shadow-md transition-shadow">
    {/* Top row: avatar + heart */}
    <div className="flex items-start justify-between mb-4">
      <div className="bg-[#ece2fe] w-[60px] h-[60px] rounded-full flex items-center justify-center">
        {kooker.avatar ? (
          <img src={kooker.avatar} alt={kooker.name} className="w-[60px] h-[60px] rounded-full object-cover" />
        ) : (
          <span className="text-[#303044] font-bold text-[24px]">
            {kooker.name.split(' ').map(n => n[0]).join('')}
          </span>
        )}
      </div>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(kooker.id); }}
        className="text-[#c1a0fd] hover:text-red-500 transition-colors"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.27 2 8.5C2 5.41 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.08C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.41 22 8.5C22 12.27 18.6 15.36 13.45 20.03L12 21.35Z"/>
        </svg>
      </button>
    </div>
    {/* Name */}
    <h3 className="text-[18px] font-semibold text-[#111125] mb-2">{kooker.name}</h3>
    {/* Specialty */}
    <p className="text-[14px] text-[#5c5c6f] mb-1">Spécialité : {kooker.specialty}</p>
    {/* City */}
    <p className="text-[14px] text-[#828294] flex items-center gap-1 mb-4">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 6.5C7.38071 6.5 8.5 5.38071 8.5 4C8.5 2.61929 7.38071 1.5 6 1.5C4.61929 1.5 3.5 2.61929 3.5 4C3.5 5.38071 4.61929 6.5 6 6.5Z" stroke="currentColor" strokeWidth="1"/>
        <path d="M6 6.5C3.5 6.5 1 8 1 10.5H11C11 8 8.5 6.5 6 6.5Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      </svg>
      {kooker.city}
    </p>
    {/* CTA Button */}
    <button className="w-full h-[44px] bg-[#c1a0fd] hover:bg-[#b090ed] text-[#111125] text-[14px] font-semibold rounded-[12px] transition-all">
      Voir le profil
    </button>
  </Link>
);

// ────────────────────────── Data Mapping Helpers ──────────────────────────

const mapApiBookingToBooking = (b: ApiBooking): Booking => ({
  id: b.id,
  serviceName: b.service.title,
  serviceType: b.service.type,
  kookerProfileId: b.kookerProfile.id,
  kookerName: `${b.kookerProfile.user.firstName} ${b.kookerProfile.user.lastName}`,
  kookerAvatar: b.kookerProfile.user.avatar || '',
  date: b.date,
  time: b.startTime,
  guests: b.guests,
  status: b.status,
  totalPrice: b.totalPriceInCents,
});

const mapApiFavoriteToKooker = (f: ApiFavorite): FavoriteKooker => {
  let specialties: string[] = [];
  try {
    specialties = JSON.parse(f.kookerProfile.specialties);
  } catch {
    specialties = [];
  }
  const minPrice = f.kookerProfile.services.length > 0
    ? Math.min(...f.kookerProfile.services.map(s => s.priceInCents))
    : 0;
  return {
    id: f.kookerProfile.id,
    name: `${f.kookerProfile.user.firstName} ${f.kookerProfile.user.lastName}`,
    avatar: f.kookerProfile.user.avatar || '',
    specialty: specialties[0] || '',
    city: f.kookerProfile.city,
    rating: f.kookerProfile.rating,
    reviewCount: f.kookerProfile.reviewCount,
    priceFrom: minPrice,
  };
};

// ────────────────────────── Main Page ──────────────────────────

const UserDashboardPage = () => {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth(); // refreshUser used for avatar upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history' | 'favorites' | 'infos'>('upcoming');
  // Personal info state for "Mes infos" tab
  const [personalInfo, setPersonalInfo] = useState({ firstName: '', lastName: '', phone: '', email: '' });
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [historyBookings, setHistoryBookings] = useState<Booking[]>([]);
  const [favorites, setFavorites] = useState<FavoriteKooker[]>([]);
  const [loading, setLoading] = useState(true);
  usePageTiming('Dashboard Utilisateur', !loading);
  const [reviewTarget, setReviewTarget] = useState<{ kookerProfileId: number; kookerName: string; bookingId: number } | null>(null);
  const [reviewedBookingIds, setReviewedBookingIds] = useState<Set<number>>(new Set());
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHovered, setReviewHovered] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Mon Compte - Weekook';

    // Init personal info from user context
    if (user) {
      setPersonalInfo({
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone ?? '',
        email: user.email ?? '',
      });
    }

    const fetchData = async () => {
      try {
        const [bookingsRes, favoritesRes] = await Promise.all([
          api.get<ApiBooking[]>('/bookings/my'),
          api.get<ApiFavorite[]>('/favorites'),
        ]);

        if (bookingsRes.success && bookingsRes.data) {
          const today = new Date().toISOString().split('T')[0];
          const mapped = bookingsRes.data.map(mapApiBookingToBooking);

          const upcoming = mapped.filter(
            b => b.status === 'awaiting_confirmation' || ((b.status === 'pending' || b.status === 'confirmed') && b.date >= today)
          ).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
          const past = mapped.filter(
            b => b.status === 'completed' || b.status === 'cancelled' || ((b.status === 'pending' || b.status === 'confirmed') && b.date < today)
          ).sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

          // Initialize reviewed booking IDs from API data
          const reviewed = new Set<number>();
          bookingsRes.data.forEach(b => {
            if (b.reviews && b.reviews.length > 0) reviewed.add(b.id);
          });
          setReviewedBookingIds(reviewed);

          setUpcomingBookings(upcoming);
          setHistoryBookings(past);
        }

        if (favoritesRes.success && favoritesRes.data) {
          setFavorites(favoritesRes.data.map(mapApiFavoriteToKooker));
        }
      } catch {
        // Silently fail — empty states will show
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSavePersonal = async () => {
    setSavingPersonal(true);
    try {
      const payload: Record<string, string> = {
        firstName: personalInfo.firstName,
        lastName: personalInfo.lastName,
        phone: personalInfo.phone,
      };
      if (personalInfo.email !== (user?.email ?? '')) payload.email = personalInfo.email;
      await api.put('/users/profile', payload);
      await refreshUser();
      toast.success('Informations mises à jour');
    } catch {
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setSavingPersonal(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch {
      navigate('/');
    }
  };

  const handleRemoveFavorite = async (id: number) => {
    try {
      await api.delete(`/favorites/${id}`);
      setFavorites(prev => prev.filter(f => f.id !== id));
    } catch {
      // Silently fail
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 800);
      const formData = new FormData();
      formData.append('file', compressed);
      const uploadRes = await api.upload<{ url: string }>('/upload', formData);
      if (uploadRes.success && uploadRes.data) {
        await api.put('/users/avatar', { avatar: uploadRes.data.url });
        await refreshUser();
        toast.success('Avatar mis à jour');
      }
    } catch {
      toast.error('Erreur lors de la mise à jour de l\'avatar');
    }
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openReviewModal = (booking: Booking) => {
    setReviewTarget({ kookerProfileId: booking.kookerProfileId, kookerName: booking.kookerName, bookingId: booking.id });
    setReviewRating(0);
    setReviewComment('');
  };

  const handleSubmitReview = async () => {
    if (!reviewTarget || reviewRating === 0) return;
    setReviewSubmitting(true);
    try {
      await api.post('/reviews', {
        kookerProfileId: reviewTarget.kookerProfileId,
        bookingId: reviewTarget.bookingId,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });
      setReviewedBookingIds(prev => new Set([...prev, reviewTarget.bookingId]));
      setReviewTarget(null);
      toast.success('Avis publié — merci !');
    } catch (err: any) {
      toast.error(err?.error || 'Erreur lors de la publication');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleCancelBooking = async (id: number) => {
    try {
      await api.put('/bookings/' + id + '/cancel');
      setUpcomingBookings(prev => prev.filter(b => b.id !== id));
      setHistoryBookings(prev => [
        ...prev,
        { ...upcomingBookings.find(b => b.id === id)!, status: 'cancelled' as const },
      ]);
      toast.success('Réservation annulée');
    } catch {
      toast.error('Erreur lors de l\'annulation');
    }
  };

  const handleConfirmCompletion = async (id: number) => {
    try {
      await api.put<{ success: boolean }>(`/bookings/${id}/confirm-completion`);
      // Move booking from upcoming to history as completed
      const booking = upcomingBookings.find(b => b.id === id);
      if (booking) {
        setUpcomingBookings(prev => prev.filter(b => b.id !== id));
        const completedBooking = { ...booking, status: 'completed' as const };
        setHistoryBookings(prev => [...prev, completedBooking]);
        // Open review modal immediately
        openReviewModal(completedBooking);
      }
      toast.success('Prestation confirmée ! Laissez un avis sur votre expérience.');
    } catch {
      toast.error('Erreur lors de la confirmation');
    }
  };

  const tabs = [
    { key: 'upcoming' as const, label: 'Mon Agenda gourmand', shortLabel: 'Agenda' },
    { key: 'history' as const, label: 'Historique', shortLabel: 'Historique' },
    { key: 'favorites' as const, label: 'Mes Kookers favoris', shortLabel: 'Favoris' },
    { key: 'infos' as const, label: 'Mes infos', shortLabel: 'Infos' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f2f4fc] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-10 w-10 text-[#c1a0fd]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-[14px] text-[#111125]/50">Chargement de votre espace...</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-[#f2f4fc]">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 lg:px-[96px] py-8 md:py-12">
        {/* Heading */}
        <div className="mb-8">
          <h1 className="text-[32px] md:text-[40px] font-semibold text-[#111125] tracking-[-0.8px] mb-2">
            MON COMPTE
          </h1>
          <p className="text-[16px] text-[#5c5c6f]">
            Gérez vos réservations et vos préférences
          </p>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-[20px] p-6 md:p-8 mb-8 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="relative group">
                <div className="w-[80px] h-[80px] rounded-full bg-[#ece2fe] flex items-center justify-center">
                  {user?.avatar ? (
                    <img src={user.avatar} alt={`${user.firstName} ${user.lastName}`} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-[#c1a0fd] font-bold text-[28px]">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </span>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-7 h-7 bg-white border border-[#e0e2ef] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke="#111125" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <div>
                <h2 className="text-[24px] font-semibold text-[#111125] mb-1">{user?.firstName} {user?.lastName}</h2>
                <p className="text-[16px] text-[#828294]">{user?.email}</p>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              {/* Bouton conditionnel : Devenir Kooker OU Mon tableau de bord Kooker */}
              {user?.kookerProfileId ? (
                <button
                  onClick={() => navigate('/kooker-dashboard')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#c1a0fd] hover:bg-[#b090ed] text-[#111125] rounded-[12px] h-[44px] text-[14px] font-medium transition-all"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/>
                    <line x1="6" y1="17" x2="18" y2="17"/>
                    <line x1="6" y1="21" x2="18" y2="21"/>
                  </svg>
                  Mon tableau de bord Kooker
                </button>
              ) : (
                <button
                  onClick={() => navigate('/devenir-kooker')}
                  className="flex items-center gap-2 px-5 py-2.5 border border-[#c1a0fd] text-[#c1a0fd] hover:bg-[#c1a0fd]/5 rounded-[12px] h-[44px] text-[14px] font-medium transition-all"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
                  </svg>
                  Devenir Kooker
                </button>
              )}

              {/* Se déconnecter */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#c1a0fd] hover:bg-[#b090ed] text-[#111125] rounded-[12px] h-[44px] text-[14px] font-medium transition-all"
              >
                se déconnecter
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center bg-white rounded-[20px] px-4 mb-6 shadow-sm">
          <div className="flex items-center gap-2 text-[#c1a0fd] pr-4 border-r border-[#e0e2ef] py-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div className="flex flex-1">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-4 text-[13px] md:text-[15px] font-semibold transition-all duration-200 border-b-[3px] ${
                  activeTab === tab.key
                    ? 'text-[#c1a0fd] border-[#c1a0fd]'
                    : 'text-[#111125]/50 border-transparent hover:text-[#111125]/80'
                }`}
              >
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Upcoming Bookings Tab */}
        {activeTab === 'upcoming' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[20px] font-semibold text-[#111125]">Mon Agenda gourmand</h3>
              <span className="text-[13px] text-[#111125]/40">{upcomingBookings.length} réservation{upcomingBookings.length > 1 ? 's' : ''}</span>
            </div>
            {upcomingBookings.length === 0 ? (
              <div className="bg-white rounded-[20px] shadow-sm p-12 text-center">
                <div className="w-16 h-16 mx-auto bg-[#c1a0fd]/10 rounded-full flex items-center justify-center mb-4">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3.5" y="4.66663" width="21" height="21" rx="3" stroke="#c1a0fd" strokeWidth="1.5"/>
                    <path d="M3.5 11.6666H24.5" stroke="#c1a0fd" strokeWidth="1.5"/>
                    <path d="M9.33333 2.33337V7.00004" stroke="#c1a0fd" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M18.6667 2.33337V7.00004" stroke="#c1a0fd" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <h4 className="text-[16px] font-semibold text-[#111125] mb-2">Aucune réservation à venir</h4>
                <p className="text-[13px] text-[#111125]/50 mb-6">Explorez nos kookers et réservez votre prochain repas fait maison.</p>
                <button
                  onClick={() => navigate('/recherche')}
                  className="px-6 py-2.5 bg-[#c1a0fd] hover:bg-[#b090ed] text-[#111125] text-[13px] font-semibold rounded-[8px] transition-all"
                >
                  Trouver un Kooker
                </button>
              </div>
            ) : (
              upcomingBookings.map(booking => (
                <BookingCard key={booking.id} booking={booking} showActions onCancel={handleCancelBooking} onViewDetails={(id) => navigate(`/reservation/${id}`)} onConfirmCompletion={handleConfirmCompletion} />
              ))
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[20px] font-semibold text-[#111125]">Historique des réservations</h3>
              <span className="text-[13px] text-[#111125]/40">{historyBookings.length} réservation{historyBookings.length > 1 ? 's' : ''}</span>
            </div>
            {historyBookings.length === 0 ? (
              <div className="bg-white rounded-[20px] shadow-sm p-12 text-center">
                <div className="w-16 h-16 mx-auto bg-[#c1a0fd]/10 rounded-full flex items-center justify-center mb-4">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="14" cy="14" r="10.5" stroke="#c1a0fd" strokeWidth="1.5"/>
                    <path d="M14 8.16663V14L17.5 17.5" stroke="#c1a0fd" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <h4 className="text-[16px] font-semibold text-[#111125] mb-2">Aucun historique</h4>
                <p className="text-[13px] text-[#111125]/50">Vos réservations passées apparaîtront ici.</p>
              </div>
            ) : (
              historyBookings.map(booking => (
                <BookingCard key={booking.id} booking={booking} onReview={openReviewModal} hasReview={reviewedBookingIds.has(booking.id)} />
              ))
            )}
          </div>
        )}

        {/* Favorites Tab */}
        {activeTab === 'favorites' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[20px] font-semibold text-[#111125]">Mes Kookers favoris</h3>
              <span className="text-[13px] text-[#111125]/40">{favorites.length} favori{favorites.length > 1 ? 's' : ''}</span>
            </div>
            {favorites.length === 0 ? (
              <div className="bg-white rounded-[20px] shadow-sm p-12 text-center">
                <div className="w-16 h-16 mx-auto bg-[#c1a0fd]/10 rounded-full flex items-center justify-center mb-4">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 25.6667C14 25.6667 2.33333 18.6667 2.33333 10.0833C2.33333 8.24854 3.06786 6.48879 4.36185 5.19479C5.65585 3.9008 7.41559 3.16626 9.25033 3.16626C11.6733 3.16626 14 4.57293 14 4.57293C14 4.57293 16.3267 3.16626 18.7497 3.16626C20.5844 3.16626 22.3442 3.9008 23.6382 5.19479C24.9321 6.48879 25.6667 8.24854 25.6667 10.0833C25.6667 18.6667 14 25.6667 14 25.6667Z" stroke="#c1a0fd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h4 className="text-[16px] font-semibold text-[#111125] mb-2">Aucun favori</h4>
                <p className="text-[13px] text-[#111125]/50 mb-6">Ajoutez des kookers à vos favoris pour les retrouver facilement.</p>
                <button
                  onClick={() => navigate('/recherche')}
                  className="px-6 py-2.5 bg-[#c1a0fd] hover:bg-[#b090ed] text-[#111125] text-[13px] font-semibold rounded-[8px] transition-all"
                >
                  Découvrir les Kookers
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {favorites.map(kooker => (
                  <FavoriteKookerCard key={kooker.id} kooker={kooker} onRemove={handleRemoveFavorite} />
                ))}
              </div>
            )}
          </div>
        )}
        {/* Mes infos Tab */}
        {activeTab === 'infos' && (
          <div className="bg-white rounded-[20px] p-6 md:p-8 shadow-sm">
            <h3 className="text-[20px] font-semibold text-[#111125] mb-6">Mes informations personnelles</h3>
            <div className="space-y-4 max-w-[600px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-[#111125] mb-1">Prénom</label>
                  <input
                    type="text"
                    value={personalInfo.firstName}
                    onChange={e => setPersonalInfo(p => ({ ...p, firstName: e.target.value }))}
                    className="w-full h-[44px] px-4 border border-[#e0e2ef] rounded-[12px] text-[14px] text-[#111125] focus:outline-none focus:border-[#c1a0fd] bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#111125] mb-1">Nom</label>
                  <input
                    type="text"
                    value={personalInfo.lastName}
                    onChange={e => setPersonalInfo(p => ({ ...p, lastName: e.target.value }))}
                    className="w-full h-[44px] px-4 border border-[#e0e2ef] rounded-[12px] text-[14px] text-[#111125] focus:outline-none focus:border-[#c1a0fd] bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#111125] mb-1">Email</label>
                <input
                  type="email"
                  value={personalInfo.email}
                  onChange={e => setPersonalInfo(p => ({ ...p, email: e.target.value }))}
                  className="w-full h-[44px] px-4 border border-[#e0e2ef] rounded-[12px] text-[14px] text-[#111125] focus:outline-none focus:border-[#c1a0fd] bg-white"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#111125] mb-1">Téléphone</label>
                <input
                  type="tel"
                  value={personalInfo.phone}
                  onChange={e => setPersonalInfo(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+33 6 00 00 00 00"
                  className="w-full h-[44px] px-4 border border-[#e0e2ef] rounded-[12px] text-[14px] text-[#111125] focus:outline-none focus:border-[#c1a0fd] bg-white placeholder:text-[#c0c2d0]"
                />
              </div>
              <div className="pt-4 flex justify-end">
                <button
                  onClick={handleSavePersonal}
                  disabled={savingPersonal}
                  className="px-8 h-[44px] bg-[#c1a0fd] hover:bg-[#b090ed] text-[#111125] text-[14px] font-semibold rounded-[12px] transition-all disabled:opacity-50"
                >
                  {savingPersonal ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* ── Review Modal ── */}
    {reviewTarget && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-[20px] p-6 w-full max-w-[420px] shadow-xl">
          <h2 className="text-[20px] font-semibold text-[#111125] mb-1">Laisser un avis</h2>
          <p className="text-[14px] text-[#828294] mb-5">pour {reviewTarget.kookerName}</p>

          {/* Stars */}
          <div className="flex gap-2 justify-center mb-5">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                type="button"
                onClick={() => setReviewRating(star)}
                onMouseEnter={() => setReviewHovered(star)}
                onMouseLeave={() => setReviewHovered(0)}
                className="text-[40px] leading-none transition-transform hover:scale-110 focus:outline-none"
              >
                <span className={(reviewHovered || reviewRating) >= star ? 'text-yellow-400' : 'text-[#e0e2ef]'}>★</span>
              </button>
            ))}
          </div>
          {reviewRating > 0 && (
            <p className="text-center text-[13px] text-[#828294] mb-4">
              {['', 'Décevant', 'Peut mieux faire', 'Bien', 'Très bien', 'Excellent !'][reviewRating]}
            </p>
          )}

          {/* Comment */}
          <textarea
            value={reviewComment}
            onChange={e => setReviewComment(e.target.value)}
            placeholder="Partagez votre expérience (facultatif)..."
            rows={3}
            className="w-full rounded-[12px] border border-[#e0e2ef] px-4 py-3 text-[14px] text-[#111125] placeholder-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#c1a0fd] focus:border-transparent resize-none mb-5"
          />

          <div className="flex gap-3">
            <button
              onClick={() => setReviewTarget(null)}
              className="flex-1 h-[48px] rounded-[12px] border border-[#e0e2ef] text-[14px] font-medium text-[#6b7280] hover:border-[#c1a0fd] transition-all"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmitReview}
              disabled={reviewRating === 0 || reviewSubmitting}
              className="flex-1 h-[48px] rounded-[12px] bg-[#c1a0fd] hover:bg-[#b090ed] text-white text-[14px] font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {reviewSubmitting
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Envoi...</>
                : 'Publier l\'avis'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default UserDashboardPage;
