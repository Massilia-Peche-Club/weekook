import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import PlanningTab from '@/components/dashboard/PlanningTab';
import { usePageTiming } from '@/hooks/usePageTiming';
import { compressImage } from '@/lib/compressImage';

// ────────────────────────── Types ──────────────────────────

interface DashboardStats {
  totalBookings: number;
  upcomingBookings: number;
  totalRevenue: number;
  activeServices: number;
  averageRating: number;
  totalReviews: number;
}

interface KookerBooking {
  id: number;
  date: string;
  startTime: string;
  guests: number;
  totalPriceInCents: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'awaiting_confirmation';
  paymentStatus?: string;
  user: { id: number; firstName: string; lastName: string; email: string };
  service: { id?: number; title: string; type?: string };
  message?: string;
  ingredientsSource?: string;
}

const REFUSAL_REASONS = [
  { id: 'unavailable',    label: 'Indisponible à cette date',            message: 'Je suis malheureusement indisponible à cette date.' },
  { id: 'guests',         label: 'Nombre de convives incompatible',       message: "Le nombre de convives n'est pas compatible avec ce service." },
  { id: 'distance',       label: 'Lieu trop éloigné',                    message: 'Le lieu de prestation est en dehors de ma zone de déplacement.' },
  { id: 'delay',          label: 'Délai trop court',                     message: 'Le délai est insuffisant pour préparer cette prestation dans les meilleures conditions.' },
  { id: 'menu',           label: 'Menu / ingrédients non disponibles',   message: 'Je ne suis pas en mesure de proposer ce service à cette date.' },
  { id: 'other_booking',  label: 'Autre engagement professionnel',        message: "J'ai déjà un engagement professionnel à cette date." },
  { id: 'custom',         label: 'Autre raison (préciser)',               message: '' },
];

interface Service {
  id: number;
  title: string;
  description?: string;
  type: string | string[];
  allergens?: unknown;
  priceInCents: number;
  extraGuestPriceInCents?: number | null;
  durationMinutes: number;
  maxGuests: number;
  active: boolean;
  images?: { id: number; url: string; isCardImage: boolean }[];
}

interface Availability {
  id: number;
  kookerProfileId: number;
  date: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

interface KookerProfile {
  bio: string;
  specialties: string[];
  city: string;
  type: string;
  experience: string;
  phone: string;
  address: string;
}

interface KookerApiProfile {
  id: number;
  bio: string;
  specialties: string;
  city: string;
  type: string;
  experience: string;
  address: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    avatar?: string;
  };
  [key: string]: unknown;
}

const allSpecialties = [
  'Méditerranéen', 'Provençal', 'Italien', 'Français', 'Japonais', 'Thaïlandais',
  'Indien', 'Mexicain', 'Végétarien', 'Vegan', 'Sans gluten', 'Bio',
  'Pâtisserie', 'Brunch', 'Apéritif', 'Gastronomique',
];

// ────────────────────────── Helper Functions ──────────────────────────

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' });
};

const formatDateLong = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

const formatPrice = (cents: number) => {
  return (cents / 100).toFixed(2).replace('.', ',') + ' EUR';
};

const formatPriceShort = (cents: number) => {
  return (cents / 100).toFixed(0) + ' EUR';
};

const safeParseJson = (val: string | string[] | unknown): string[] => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

// ────────────────────────── Status Badge ──────────────────────────

const StatusBadge = ({ status }: { status: KookerBooking['status'] }) => {
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

const PAYMENT_BADGE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  authorized:             { label: 'Pré-autorisé', bg: 'bg-[#fff7ed]', text: 'text-orange-500' },
  captured:               { label: 'Payé', bg: 'bg-[#e8f5e9]', text: 'text-green-600' },
  transferred:            { label: 'Versé', bg: 'bg-[#d1fae5]', text: 'text-green-700' },
  refunded:               { label: 'Remboursé', bg: 'bg-[#f5f5f5]', text: 'text-[#828294]' },
  awaiting_confirmation:  { label: 'À confirmer', bg: 'bg-[#fef3c7]', text: 'text-[#d97706]' },
};

const PaymentBadge = ({ paymentStatus }: { paymentStatus?: string }) => {
  if (!paymentStatus || !PAYMENT_BADGE_CONFIG[paymentStatus]) return null;
  const c = PAYMENT_BADGE_CONFIG[paymentStatus];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
};

// ────────────────────────── Stat Card ──────────────────────────

const StatCard = ({ icon, label, value, subtitle, color }: { icon: React.ReactNode; label: string; value: string; subtitle?: string; color: string }) => (
  <div className="bg-white rounded-[20px] p-6 shadow-sm">
    <div className="flex items-start justify-between mb-3">
      <div className={`w-[48px] h-[48px] rounded-full flex items-center justify-center ${color}`}>
        {icon}
      </div>
    </div>
    <p className="text-[14px] text-[#828294] mb-1">{label}</p>
    <p className="text-[32px] font-semibold text-[#111125]">{value}</p>
    {subtitle && <p className="text-[12px] text-[#111125]/35 mt-0.5">{subtitle}</p>}
  </div>
);

// ────────────────────────── Loading Spinner ──────────────────────────

const SectionSpinner = ({ text }: { text?: string }) => (
  <div className="flex flex-col items-center justify-center py-16">
    <svg className="animate-spin h-8 w-8 text-[#c1a0fd]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    {text && <p className="text-[13px] text-[#111125]/50 mt-3">{text}</p>}
  </div>
);

// ────────────────────────── Main Page ──────────────────────────

const KookerDashboardPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'bookings' | 'planning' | 'services' | 'profile'>(
    (location.state as any)?.tab || 'bookings'
  );
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'awaiting_confirmation'>('all');

  // Data states
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [bookings, setBookings] = useState<KookerBooking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [profile, setProfile] = useState<KookerProfile>({
    bio: '',
    specialties: [],
    city: '',
    type: '',
    experience: '',
    phone: '',
    address: '',
  });
  const [originalProfile, setOriginalProfile] = useState<KookerProfile | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [cardImageUpdating, setCardImageUpdating] = useState(false);

  // Loading states
  const [loading, setLoading] = useState(true);
  usePageTiming('Dashboard Kooker', !loading);
  const [statsLoading, setStatsLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [availabilitiesLoading, setAvailabilitiesLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [expandedServiceId, setExpandedServiceId] = useState<number | null>(null);

  // ── Delete service confirmation state ──
  const [pendingDeleteServiceId, setPendingDeleteServiceId] = useState<number | null>(null);

  // ── Refusal modal state ──
  const [pendingAcceptance, setPendingAcceptance] = useState<{ bookingId: number; clientName: string; serviceTitle: string; date: string; startTime: string; guests: number; totalPriceInCents: number } | null>(null);
  const [pendingRefusal, setPendingRefusal] = useState<{ bookingId: number; userId: number; serviceId?: number } | null>(null);
  const [refusalReasonId, setRefusalReasonId] = useState('unavailable');
  const [refusalCustom, setRefusalCustom] = useState('');

  // ── Stripe Connect status ──
  const [stripeStatus, setStripeStatus] = useState<{ connected: boolean; onboardingComplete: boolean } | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);

  const kookerProfileId = user?.kookerProfileId;

  // ── Fetch Stats ──
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await api.get<DashboardStats>('/kookers/dashboard/stats');
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ── Fetch Bookings ──
  const fetchBookings = useCallback(async () => {
    setBookingsLoading(true);
    try {
      const res = await api.get<KookerBooking[]>('/bookings/kooker');
      if (res.success && res.data) {
        setBookings(res.data);
      }
    } catch (err) {
      console.error('Failed to load bookings:', err);
    } finally {
      setBookingsLoading(false);
    }
  }, []);

  // ── Fetch Services ──
  const fetchServices = useCallback(async () => {
    if (!kookerProfileId) return;
    setServicesLoading(true);
    try {
      const res = await api.get<Service[]>(`/services/kooker/${kookerProfileId}`);
      if (res.success && res.data) {
        setServices(res.data);
      }
    } catch (err) {
      console.error('Failed to load services:', err);
    } finally {
      setServicesLoading(false);
    }
  }, [kookerProfileId]);

  // ── Fetch Availabilities ──
  const fetchAvailabilities = useCallback(async () => {
    if (!kookerProfileId) return;
    setAvailabilitiesLoading(true);
    try {
      const res = await api.get<Availability[]>(`/availability/kooker/${kookerProfileId}`);
      if (res.success && res.data) {
        setAvailabilities(res.data);
      }
    } catch (err) {
      console.error('Failed to load availabilities:', err);
    } finally {
      setAvailabilitiesLoading(false);
    }
  }, [kookerProfileId]);

  // ── Fetch Profile ──
  const fetchProfile = useCallback(async () => {
    if (!kookerProfileId) return;
    setProfileLoading(true);
    try {
      const res = await api.get<KookerApiProfile>(`/kookers/${kookerProfileId}`);
      if (res.success && res.data) {
        const p = res.data;
        const parsed: KookerProfile = {
          bio: p.bio || '',
          specialties: safeParseJson(p.specialties),
          city: p.city || '',
          type: safeParseJson(p.type)[0] || (typeof p.type === 'string' ? p.type : ''),
          experience: p.experience || '',
          phone: p.user?.phone || '',
          address: p.address || '',
        };
        setProfile(parsed);
        setOriginalProfile(parsed);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setProfileLoading(false);
    }
  }, [kookerProfileId]);

  // ── Fetch Stripe Connect status ──
  const fetchStripeStatus = useCallback(async () => {
    try {
      const res = await api.get<{ connected: boolean; onboardingComplete: boolean }>('/stripe/connect/status');
      if (res.success && res.data) {
        setStripeStatus(res.data);
      }
    } catch { /* ignore */ }
  }, []);

  const handleStripeOnboard = async () => {
    setStripeLoading(true);
    try {
      const res = await api.post<{ url: string }>('/stripe/connect/onboard');
      if (res.success && res.data?.url) {
        window.location.href = res.data.url;
      } else {
        toast.error('Erreur lors de la configuration Stripe.');
      }
    } catch (err: any) {
      toast.error(err?.error || 'Erreur lors de la configuration Stripe.');
    } finally {
      setStripeLoading(false);
    }
  };

  // ── Initial Load ──
  useEffect(() => {
    document.title = 'Mon tableau de bord Kooker - Weekook';
    const loadAll = async () => {
      await Promise.all([fetchStats(), fetchBookings(), fetchStripeStatus()]);
      setLoading(false);
    };
    loadAll();

    // Handle Stripe return URL params
    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe') === 'return') {
      fetchStripeStatus();
      toast.success('Configuration Stripe mise à jour.');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('stripe') === 'refresh') {
      toast.info('Veuillez relancer la configuration Stripe.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [fetchStats, fetchBookings, fetchStripeStatus]);

  // ── Tab-based lazy loading ──
  useEffect(() => {
    if (activeTab === 'services' && servicesLoading && services.length === 0) {
      fetchServices();
    }
    if (activeTab === 'planning' && availabilitiesLoading && availabilities.length === 0) {
      fetchAvailabilities();
    }
    if (activeTab === 'profile' && profileLoading && !originalProfile) {
      fetchProfile();
    }
    if (activeTab === 'profile' && servicesLoading && services.length === 0) {
      fetchServices();
    }
  }, [activeTab, fetchServices, fetchAvailabilities, fetchProfile, servicesLoading, availabilitiesLoading, profileLoading, services.length, availabilities.length, originalProfile]);

  // ── Actions ──

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
      toast.error("Erreur lors de la mise à jour de l'avatar");
    } finally {
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleSetCardImage = async (imageId: number) => {
    setCardImageUpdating(true);
    try {
      await api.put(`/services/card-image/${imageId}`, {});
      setServices(prev => prev.map(s => ({
        ...s,
        images: (s.images || []).map(img => ({ ...img, isCardImage: img.id === imageId })),
      })));
      toast.success('Photo de vignette mise à jour');
    } catch {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setCardImageUpdating(false);
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

  const handleUpdateBookingStatus = async (bookingId: number, status: 'confirmed' | 'cancelled') => {
    try {
      await api.put(`/bookings/${bookingId}/status`, { status });
      toast.success(status === 'confirmed' ? 'Réservation confirmée' : 'Réservation refusée');
      fetchBookings();
      fetchStats();
    } catch (err: any) {
      toast.error(err?.error || 'Erreur lors de la mise à jour');
    }
  };

  const handleConfirmAcceptance = async () => {
    if (!pendingAcceptance) return;
    await handleUpdateBookingStatus(pendingAcceptance.bookingId, 'confirmed');
    setPendingAcceptance(null);
  };

  const handleConfirmRefusal = async () => {
    if (!pendingRefusal) return;
    const reason = REFUSAL_REASONS.find((r) => r.id === refusalReasonId);
    const messageContent = refusalReasonId === 'custom'
      ? refusalCustom.trim()
      : reason?.message || '';
    if (!messageContent) {
      toast.error('Veuillez préciser la raison du refus.');
      return;
    }
    try {
      await api.put(`/bookings/${pendingRefusal.bookingId}/status`, { status: 'cancelled' });
      if (pendingRefusal.serviceId) {
        await api.post('/messages', {
          receiverId: pendingRefusal.userId,
          content: `Votre réservation a été refusée.\n\nRaison : ${messageContent}`,
          serviceId: pendingRefusal.serviceId,
        });
      }
      toast.success('Réservation refusée — le client a été notifié par message.');
      fetchBookings();
      fetchStats();
    } catch (err: any) {
      toast.error(err?.error || 'Erreur lors du refus');
    } finally {
      setPendingRefusal(null);
      setRefusalReasonId('unavailable');
      setRefusalCustom('');
    }
  };

  const handleToggleService = async (id: number) => {
    const service = services.find(s => s.id === id);
    if (!service) return;
    try {
      await api.put(`/services/${id}`, { active: !service.active });
      setServices(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s));
      toast.success(service.active ? 'Offre désactivée' : 'Offre activée');
      fetchStats();
    } catch (err: any) {
      toast.error(err?.error || 'Erreur lors de la mise à jour');
    }
  };

  const handleDeleteService = (id: number) => {
    setPendingDeleteServiceId(id);
  };

  const confirmDeleteService = async () => {
    if (!pendingDeleteServiceId) return;
    const id = pendingDeleteServiceId;
    setPendingDeleteServiceId(null);
    try {
      await api.delete(`/services/${id}`);
      setServices(prev => prev.filter(s => s.id !== id));
      toast.success('Offre supprimée');
      fetchStats();
    } catch (err: any) {
      toast.error(err?.error || 'Erreur lors de la suppression');
    }
  };

  const handleProfileSave = async () => {
    setProfileSaving(true);
    try {
      await api.put('/kookers/profile', {
        bio: profile.bio,
        specialties: profile.specialties,
        city: profile.city,
        type: [profile.type],
        experience: profile.experience,
        address: profile.address,
      });
      await api.put('/users/profile', {
        phone: profile.phone,
      });
      setOriginalProfile({ ...profile });
      toast.success('Profil mis à jour avec succès !');
    } catch (err: any) {
      toast.error(err?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleProfileCancel = () => {
    if (originalProfile) {
      setProfile(originalProfile);
    }
  };

  const toggleSpecialty = (specialty: string) => {
    setProfile(prev => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter(s => s !== specialty)
        : [...prev.specialties, specialty],
    }));
  };

  const filteredBookings = useMemo(() => {
    const filtered = bookingFilter === 'all' ? bookings : bookings.filter(b => b.status === bookingFilter);
    return [...filtered].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }, [bookingFilter, bookings]);

  const tabs = [
    {
      key: 'bookings' as const,
      label: 'Réservations',
      shortLabel: 'Résa.',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="2.66663" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M2 6.66663H14" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M5.33333 1.33337V4.00004" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M10.6667 1.33337V4.00004" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      key: 'planning' as const,
      label: 'Planning',
      shortLabel: 'Plan.',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M8 4.66663V7.99996L10 9.99996" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      key: 'services' as const,
      label: 'Mes Offres',
      shortLabel: 'Offres',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 4.66663H14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M2 8H14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M2 11.3334H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      key: 'profile' as const,
      label: 'Mes Infos Kooker',
      shortLabel: 'Infos',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="8" cy="5.33337" r="2.66667" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M2.66667 13.3334C2.66667 11.1242 4.45753 9.33337 6.66667 9.33337H9.33333C11.5425 9.33337 13.3333 11.1242 13.3333 13.3334" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f2f4fc] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-10 w-10 text-[#c1a0fd]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-[14px] text-[#111125]/50">Chargement de votre espace kooker...</p>
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
          <p className="text-[13px] text-[#828294] mb-3">/Profil/dashboard_kooker</p>
          <h1 className="text-[32px] md:text-[40px] font-semibold text-[#111125] tracking-[-0.8px] mb-2">
            MON TABLEAU DE BORD KOOKER
          </h1>
          <p className="text-[16px] text-[#5c5c6f]">
            Gérez vos prestations et suivez votre activité
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
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <button
                  onClick={() => avatarInputRef.current?.click()}
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
              {/* Mon compte button */}
              <button
                onClick={() => navigate('/tableau-de-bord')}
                className="flex items-center gap-2 px-5 py-2.5 border border-[#c1a0fd] text-[#c1a0fd] hover:bg-[#c1a0fd]/5 rounded-[12px] h-[44px] text-[14px] font-medium transition-all"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                Mon compte
              </button>

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
        {/* Stripe Connect Banner */}
        {stripeStatus && !stripeStatus.onboardingComplete && (
          <div className="mb-6 bg-gradient-to-r from-[#f3ecff] to-[#e8e0ff] border border-[#c1a0fd]/30 rounded-[16px] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#c1a0fd] flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[#111125]">Configurez vos paiements</p>
                <p className="text-[13px] text-[#6b7280] mt-0.5">
                  Pour recevoir les paiements de vos clients, connectez votre compte bancaire via Stripe.
                </p>
              </div>
            </div>
            <button
              onClick={handleStripeOnboard}
              disabled={stripeLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#c1a0fd] hover:bg-[#b090ed] text-white text-[14px] font-semibold rounded-[12px] transition-all disabled:opacity-50 flex-shrink-0"
            >
              {stripeLoading ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Configuration...</>
              ) : (
                'Configurer Stripe'
              )}
            </button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2.5" y="3.33337" width="15" height="15" rx="2" stroke="white" strokeWidth="1.5"/>
                <path d="M2.5 8.33337H17.5" stroke="white" strokeWidth="1.5"/>
                <path d="M6.66667 1.66663V4.99996" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M13.3333 1.66663V4.99996" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            }
            label="Total réservations"
            value={statsLoading ? '...' : (stats?.totalBookings ?? 0).toString()}
            subtitle="Toutes confondues"
            color="bg-[#c1a0fd]"
          />
          <StatCard
            icon={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="10" cy="10" r="7.5" stroke="white" strokeWidth="1.5"/>
                <path d="M10 5.83337V10L12.5 12.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            }
            label="A venir"
            value={statsLoading ? '...' : (stats?.upcomingBookings ?? 0).toString()}
            subtitle="Prochaines réservations"
            color="bg-yellow-500"
          />
          <StatCard
            icon={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 1.66663L12.575 6.88329L18.3333 7.72496L14.1667 11.7833L15.15 17.5166L10 14.8083L4.85 17.5166L5.83333 11.7833L1.66667 7.72496L7.425 6.88329L10 1.66663Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
            label="Note moyenne"
            value={statsLoading ? '...' : (stats?.averageRating ?? 0).toString()}
            subtitle={statsLoading ? '...' : `${stats?.totalReviews ?? 0} avis`}
            color="bg-[#c1a0fd]"
          />
          <StatCard
            icon={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.5 10H15L12.5 17.5L7.5 2.5L5 10H2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
            label="Revenu total"
            value={statsLoading ? '...' : formatPriceShort(stats?.totalRevenue ?? 0)}
            subtitle="Depuis le début"
            color="bg-green-500"
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center bg-white rounded-[20px] px-4 mb-8 shadow-sm">
          <div className="flex items-center gap-2 text-[#c1a0fd] pr-4 border-r border-[#e0e2ef] py-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
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

        {/* ────────────────────── BOOKINGS TAB ────────────────────── */}
        {activeTab === 'bookings' && (
          <div>
            {/* Filter */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              {[
                { key: 'all' as const, label: 'Toutes' },
                { key: 'pending' as const, label: 'En attente' },
                { key: 'awaiting_confirmation' as const, label: 'À confirmer' },
                { key: 'confirmed' as const, label: 'Confirmées' },
                { key: 'completed' as const, label: 'Terminées' },
                { key: 'cancelled' as const, label: 'Annulées' },
              ].map(filter => {
                const count = filter.key === 'all' ? bookings.length : bookings.filter(b => b.status === filter.key).length;
                const isAction = filter.key === 'pending' || filter.key === 'awaiting_confirmation';
                return (
                  <button
                    key={filter.key}
                    onClick={() => setBookingFilter(filter.key)}
                    className={`relative px-4 py-2 text-[13px] font-medium rounded-[10px] transition-all ${
                      bookingFilter === filter.key
                        ? 'bg-[#c1a0fd] text-white'
                        : 'bg-white border border-[#e0e2ef] text-[#111125]/60 hover:border-[#c1a0fd]/30 hover:text-[#111125]'
                    }`}
                  >
                    {filter.label}
                    {count > 0 && (
                      <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[11px] font-bold rounded-full ${
                        bookingFilter === filter.key
                          ? 'bg-white/25 text-white'
                          : isAction && count > 0
                            ? 'bg-red-500 text-white'
                            : 'bg-[#e0e2ef] text-[#111125]/60'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Bookings List */}
            {bookingsLoading ? (
              <SectionSpinner text="Chargement des réservations..." />
            ) : (
              <div className="space-y-4">
                {filteredBookings.length === 0 ? (
                  <div className="bg-white rounded-[20px] p-12 text-center shadow-sm">
                    <div className="w-16 h-16 mx-auto bg-[#c1a0fd]/10 rounded-full flex items-center justify-center mb-4">
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="3.5" y="4.66663" width="21" height="21" rx="3" stroke="#c1a0fd" strokeWidth="1.5"/>
                        <path d="M3.5 11.6666H24.5" stroke="#c1a0fd" strokeWidth="1.5"/>
                      </svg>
                    </div>
                    <h4 className="text-[16px] font-semibold text-[#111125] mb-2">Aucune réservation</h4>
                    <p className="text-[13px] text-[#111125]/50">Aucune réservation ne correspond à ce filtre.</p>
                  </div>
                ) : (
                  filteredBookings.map(booking => {
                    const clientName = `${booking.user.firstName} ${booking.user.lastName}`;
                    return (
                      <div
                        key={booking.id}
                        className={`bg-white rounded-[20px] p-5 md:p-6 shadow-sm transition-shadow hover:shadow-md ${
                          booking.status === 'pending' ? 'border-l-4 border-l-yellow-400' : booking.status === 'awaiting_confirmation' ? 'border-l-4 border-l-[#d97706]' : ''
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <div className="flex gap-4 flex-1 min-w-0">
                            {/* Client Avatar */}
                            <div className="w-12 h-12 rounded-full bg-[#c1a0fd]/20 flex items-center justify-center flex-shrink-0">
                              <span className="text-[#c1a0fd] font-bold text-[14px]">
                                {booking.user.firstName?.[0]}{booking.user.lastName?.[0]}
                              </span>
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <h4 className="text-[15px] font-semibold text-[#111125]">{clientName}</h4>
                                <StatusBadge status={booking.status} />
                                <PaymentBadge paymentStatus={booking.paymentStatus} />
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <p className="text-[13px] text-[#c1a0fd] font-medium">{booking.service.title}</p>
                                {(() => {
                                  const t = booking.service.type || '';
                                  const isKours = Array.isArray(t) ? (t as string[]).includes('COURS') : String(t).includes('COURS');
                                  const isKook = !isKours && String(t).includes('KOOK');
                                  return isKours
                                    ? <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-bold bg-[#c1a0fd] text-white">COURS</span>
                                    : isKook
                                      ? <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-bold bg-[#7c5cbf] text-white">KOOK</span>
                                      : null;
                                })()}
                              </div>

                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[#111125]/60">
                                <span className="flex items-center gap-1.5">
                                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <rect x="1.75" y="2.33337" width="10.5" height="10.5" rx="1.5" stroke="currentColor" strokeWidth="1.1"/>
                                    <path d="M1.75 5.83337H12.25" stroke="currentColor" strokeWidth="1.1"/>
                                    <path d="M4.66667 1.16663V3.49996" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                                    <path d="M9.33333 1.16663V3.49996" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                                  </svg>
                                  {formatDate(booking.date)}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="7" cy="7" r="5.25" stroke="currentColor" strokeWidth="1.1"/>
                                    <path d="M7 4.08337V7.00004L8.75 8.75004" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                                  </svg>
                                  {booking.startTime}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M9.91667 12.25V11.0833C9.91667 10.4645 9.67083 9.871 9.23325 9.43342C8.79567 8.99583 8.20217 8.75 7.58333 8.75H3.5C2.88116 8.75 2.28767 8.99583 1.85008 9.43342C1.4125 9.871 1.16667 10.4645 1.16667 11.0833V12.25" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                                    <circle cx="5.54167" cy="4.08333" r="2.33333" stroke="currentColor" strokeWidth="1.1"/>
                                  </svg>
                                  {booking.guests} {(() => { const t = String(booking.service.type || ''); return t.includes('COURS') ? 'participant' : 'convive'; })()}{booking.guests > 1 ? 's' : ''}
                                </span>
                              </div>

                              {booking.ingredientsSource && booking.ingredientsSource !== 'client' && (
                                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#f3ecff] text-[#7c5cbf] text-[12px] font-semibold rounded-[8px]">
                                  👨‍🍳 Le kooker fournit les ingrédients
                                </div>
                              )}

                              {booking.message && (
                                <div className="mt-3 p-3 bg-[#f2f4fc] rounded-[10px]">
                                  <p className="text-[12px] text-[#111125]/40 mb-1 font-medium">Message du client :</p>
                                  <p className="text-[13px] text-[#111125]/70 leading-relaxed">{booking.message}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-3 md:gap-4 md:ml-4">
                            <p className="text-[18px] font-bold text-[#111125]">{formatPrice(booking.totalPriceInCents)}</p>

                            {booking.status === 'pending' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setPendingAcceptance({
                                    bookingId: booking.id,
                                    clientName: `${booking.user.firstName} ${booking.user.lastName}`.trim(),
                                    serviceTitle: booking.service.title,
                                    date: booking.date,
                                    startTime: booking.startTime,
                                    guests: booking.guests,
                                    totalPriceInCents: booking.totalPriceInCents,
                                  })}
                                  className="px-4 py-2 text-[13px] font-semibold text-white bg-[#c1a0fd] hover:bg-[#b090ed] rounded-[10px] transition-all flex items-center gap-1.5"
                                >
                                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M11.6667 3.5L5.25 9.91667L2.33333 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                  Accepter
                                </button>
                                <button
                                  onClick={() => setPendingRefusal({ bookingId: booking.id, userId: booking.user.id, serviceId: booking.service?.id })}
                                  className="px-4 py-2 text-[13px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-[10px] transition-all flex items-center gap-1.5"
                                >
                                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M10.5 3.5L3.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                    <path d="M3.5 3.5L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                  </svg>
                                  Refuser
                                </button>
                              </div>
                            )}

                            {booking.status === 'awaiting_confirmation' && (
                              <div className="bg-yellow-50 border border-yellow-200 rounded-[12px] p-3 text-[13px] text-yellow-800">
                                En attente de confirmation du client. Validation automatique sous 48h.
                              </div>
                            )}

                            <button
                              onClick={() => navigate(`/reservation/${booking.id}`)}
                              className="px-4 py-2 text-[13px] font-medium text-[#111125] bg-[#f2f4fc] hover:bg-[#e8eaf6] rounded-[10px] transition-all flex items-center gap-1.5"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                              </svg>
                              Détails
                            </button>
                            <button
                              onClick={() => navigate(`/messagerie?to=${booking.user.id}${booking.service?.id ? `&service=${booking.service.id}` : ''}`)}
                              className="px-4 py-2 text-[13px] font-medium text-[#c1a0fd] bg-[#f3ecff] hover:bg-[#ebe0ff] rounded-[10px] transition-all flex items-center gap-1.5"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              Contacter
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* ────────────────────── PLANNING TAB ────────────────────── */}
        {activeTab === 'planning' && (
          <PlanningTab
            availabilities={availabilities}
            availabilitiesLoading={availabilitiesLoading}
            onSaved={fetchAvailabilities}
            bookings={bookings}
          />
        )}

        {/* ────────────────────── SERVICES TAB ────────────────────── */}
        {activeTab === 'services' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-[16px] font-bold text-[#111125]">Mes Offres</h3>
                <p className="text-[13px] text-[#111125]/50 mt-1">{services.length} offre{services.length > 1 ? 's' : ''} au total</p>
              </div>
              <button
                onClick={() => navigate('/kooker-dashboard/menu/nouveau')}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#c1a0fd] hover:bg-[#b090ed] text-white text-[13px] font-semibold rounded-[12px] transition-all self-start sm:self-auto"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 3.33337V12.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M3.33333 8H12.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Créer une offre
              </button>
            </div>

            {servicesLoading ? (
              <SectionSpinner text="Chargement des offres..." />
            ) : (
              <div className="space-y-4">
                {services.length === 0 ? (
                  <div className="bg-white rounded-[20px] p-12 text-center shadow-sm">
                    <div className="w-16 h-16 mx-auto bg-[#c1a0fd]/10 rounded-full flex items-center justify-center mb-4">
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4.66667 9.33337H23.3333" stroke="#c1a0fd" strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M4.66667 14H23.3333" stroke="#c1a0fd" strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M4.66667 18.6666H16.3333" stroke="#c1a0fd" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <h4 className="text-[16px] font-semibold text-[#111125] mb-2">Aucune offre</h4>
                    <p className="text-[13px] text-[#111125]/50 mb-6">Créez votre première offre pour commencer à recevoir des réservations.</p>
                    <button
                      onClick={() => navigate('/kooker-dashboard/menu/nouveau')}
                      className="px-6 py-2.5 bg-[#c1a0fd] hover:bg-[#b090ed] text-white text-[13px] font-semibold rounded-[12px] transition-all"
                    >
                      Créer ma première offre
                    </button>
                  </div>
                ) : (
                  services.map(service => {
                    const serviceTypes = safeParseJson(service.type);
                    const allergens = safeParseJson(service.allergens);
                    const isKook = serviceTypes.includes('KOOK');
                    const isKours = serviceTypes.includes('COURS');
                    const typeLabel = serviceTypes[0] || '';
                    const allImages = service.images || [];
                    const mainImage = allImages[0]?.url || '';
                    const thumbImages = allImages.slice(1);
                    const isExpanded = expandedServiceId === service.id;

                    return (
                      <div
                        key={service.id}
                        className="bg-white rounded-[20px] shadow-sm overflow-hidden"
                      >
                        {/* ── Header row (always visible, clickable) ── */}
                        <div
                          className="flex items-stretch cursor-pointer"
                          onClick={() => setExpandedServiceId(isExpanded ? null : service.id)}
                        >
                          {/* Image */}
                          <div className="relative w-[130px] md:w-[160px] flex-shrink-0 min-h-[130px]">
                            <div className="w-full h-full bg-gradient-to-br from-[#c1a0fd]/15 to-[#c1a0fd]/5 overflow-hidden">
                              {mainImage ? (
                                <img
                                  src={mainImage}
                                  alt={service.title}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M4 24L11.3333 16.6667L16 21.3333L21.3333 16L28 22.6667" stroke="#c1a0fd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"/>
                                    <circle cx="11" cy="11" r="3" stroke="#c1a0fd" strokeWidth="1.5" opacity="0.4"/>
                                  </svg>
                                </div>
                              )}
                            </div>
                            {/* KOOK/COURS badges */}
                            <div className="absolute top-2 left-2 flex gap-1">
                              {isKook && <span className="px-2 py-0.5 bg-[#c1a0fd] text-white text-[10px] font-bold rounded-[6px]">KOOK</span>}
                              {isKours && <span className="px-2 py-0.5 bg-[#c1a0fd] text-white text-[10px] font-bold rounded-[6px]">COURS</span>}
                            </div>
                            {/* Allergen overlay */}
                            {allergens.length > 0 && (
                              <div className="absolute bottom-2 left-1 right-1 flex flex-wrap gap-1">
                                {allergens.map((a: string) => (
                                  <span key={a} className="px-1.5 py-0.5 bg-green-500 text-white text-[9px] font-medium rounded-[4px]">✓ {a}</span>
                                ))}
                              </div>
                            )}
                            {/* Inactif overlay */}
                            {!service.active && (
                              <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                                <span className="px-2 py-1 bg-[#828294] text-white text-[11px] font-semibold rounded-[6px]">Inactif</span>
                              </div>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 flex items-center justify-between gap-3 px-4 py-4 min-w-0">
                            <div className="min-w-0">
                              <h4 className="text-[15px] font-semibold text-[#111125] mb-1 truncate">{service.title}</h4>
                              {typeLabel && (
                                <span className="text-[11px] text-[#c1a0fd] bg-[#c1a0fd]/10 px-2 py-0.5 rounded-[6px] font-medium">{typeLabel}</span>
                              )}
                              <div className="mt-2">
                                {isKook ? (
                                  <>
                                    <p className="text-[14px] font-semibold text-[#111125]">
                                      Forfait {Math.round(service.priceInCents / 100)}€
                                    </p>
                                    {service.extraGuestPriceInCents != null && service.extraGuestPriceInCents > 0 && (
                                      <p className="text-[11px] text-[#6b7280]">
                                        + {Math.round(service.extraGuestPriceInCents / 100)}€/pers. supp.
                                      </p>
                                    )}
                                  </>
                                ) : (
                                  <p className="text-[14px] font-semibold text-[#111125]">
                                    À partir de {Math.round(service.priceInCents / 100)}€
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={(e) => { e.stopPropagation(); navigate(`/kooker-dashboard/menu/${service.id}/editer`); }}
                                className="px-3 py-2 bg-[#c1a0fd] hover:bg-[#b090ed] text-white text-[12px] font-semibold rounded-[10px] transition-all"
                              >
                                Modifier
                              </button>
                              <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M5 7.5L10 12.5L15 7.5" stroke="#111125" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"/>
                                </svg>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* ── Expanded content ── */}
                        {isExpanded && (
                          <div className="border-t border-[#e0e2ef]">
                            {/* Thumbnails */}
                            {thumbImages.length > 0 && (
                              <div className="flex gap-2 px-4 pt-4">
                                {thumbImages.map((img, i) => (
                                  <div key={i} className="w-[60px] h-[60px] rounded-[10px] overflow-hidden flex-shrink-0 bg-[#f2f4fc]">
                                    <img
                                      src={img.url}
                                      alt=""
                                      className="w-full h-full object-cover"
                                      onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Details */}
                            <div className="px-4 pt-4 pb-2">
                              {service.description && (
                                <p className="text-[13px] text-[#111125]/60 leading-relaxed mb-4">{service.description}</p>
                              )}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-[11px] text-[#111125]/40 font-medium mb-0.5">Durée</p>
                                  <p className="text-[13px] font-semibold text-[#111125]">{service.durationMinutes} min</p>
                                </div>
                                <div>
                                  <p className="text-[11px] text-[#111125]/40 font-medium mb-0.5">{isKours ? 'Participants max' : 'Convives max'}</p>
                                  <p className="text-[13px] font-semibold text-[#111125]">{service.maxGuests} pers.</p>
                                </div>
                              </div>
                            </div>

                            {/* Bottom action bar */}
                            <div className="flex items-center gap-2 px-4 pb-4 pt-3 mt-2 border-t border-[#e0e2ef]">
                              <button
                                onClick={() => handleToggleService(service.id)}
                                className={`flex-1 h-[40px] text-[13px] font-semibold rounded-[10px] border transition-all ${
                                  service.active
                                    ? 'border-orange-400 text-orange-500 hover:bg-orange-50'
                                    : 'border-green-500 text-green-600 hover:bg-green-50'
                                }`}
                              >
                                {service.active ? 'Désactiver' : 'Activer'}
                              </button>
                              <button
                                onClick={() => handleDeleteService(service.id)}
                                className="h-[40px] px-4 text-[13px] font-semibold text-red-500 border border-red-400 hover:bg-red-50 rounded-[10px] transition-all flex-shrink-0"
                              >
                                Supprimer
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* ────────────────────── PROFILE TAB ────────────────────── */}
        {activeTab === 'profile' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-[16px] font-bold text-[#111125]">Mon Profil Kooker</h3>
                <p className="text-[13px] text-[#111125]/50 mt-1">Modifiez les informations de votre profil kooker.</p>
              </div>
            </div>

            {profileLoading ? (
              <SectionSpinner text="Chargement du profil..." />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Avatar + Preview */}
                <div className="lg:col-span-1">
                  <div className="bg-white rounded-[20px] p-6 shadow-sm sticky top-8">
                    {/* Avatar */}
                    <div className="flex flex-col items-center text-center mb-6">
                      <input
                        type="file"
                        ref={avatarInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarUpload}
                      />
                      <div
                        className="w-24 h-24 rounded-full bg-gradient-to-br from-[#c1a0fd] to-[#9171d9] flex items-center justify-center mb-4 relative group cursor-pointer"
                        onClick={() => avatarInputRef.current?.click()}
                      >
                        {user?.avatar ? (
                          <img src={user.avatar} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <span className="text-white font-bold text-[28px]">
                            {user?.firstName?.[0]}{user?.lastName?.[0]}
                          </span>
                        )}
                        <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15.833 2.5L17.4997 4.16667L4.99967 16.6667H3.33301V15L15.833 2.5Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>
                      <h4 className="text-[17px] font-bold text-[#111125]">{user?.firstName} {user?.lastName}</h4>
                      <p className="text-[13px] text-[#c1a0fd] font-medium mt-1">{profile.type}</p>
                      <p className="text-[13px] text-[#111125]/50 mt-0.5">{profile.city}</p>
                    </div>

                    {/* Photo vignette : sélection depuis les images de services */}
                    <div className="mb-6 border-t border-[#e0e2ef] pt-6">
                      <p className="text-[13px] font-semibold text-[#111125] mb-1">Photo de vignette</p>
                      <p className="text-[11px] text-[#111125]/40 mb-3">Apparaît sur votre carte dans la recherche</p>
                      {(() => {
                        const allImages = services.flatMap(s =>
                          (s.images || []).map(img => ({ ...img, serviceTitle: s.title }))
                        );
                        if (allImages.length === 0) {
                          return (
                            <div className="w-full h-[80px] rounded-[12px] bg-[#f2f4fc] border border-[#e0e2ef] flex flex-col items-center justify-center gap-1">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c1a0fd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                              </svg>
                              <p className="text-[11px] text-[#111125]/40">Ajoutez des photos à vos offres</p>
                            </div>
                          );
                        }
                        if (allImages.length === 1) {
                          const img = allImages[0];
                          return (
                            <div className="w-full h-[90px] rounded-[12px] overflow-hidden border-2 border-[#c1a0fd]">
                              <img src={img.url.startsWith('/') || img.url.startsWith('http') ? img.url : `/uploads/${img.url}`} alt={img.serviceTitle} className="w-full h-full object-cover" />
                            </div>
                          );
                        }
                        return (
                          <div className={`grid grid-cols-3 gap-1.5 ${cardImageUpdating ? 'opacity-50 pointer-events-none' : ''}`}>
                            {allImages.map(img => {
                              const src = img.url.startsWith('/') || img.url.startsWith('http') ? img.url : `/uploads/${img.url}`;
                              return (
                                <button
                                  key={img.id}
                                  onClick={() => !img.isCardImage && handleSetCardImage(img.id)}
                                  title={img.isCardImage ? 'Photo actuelle' : `Sélectionner — ${img.serviceTitle}`}
                                  className={`relative aspect-square rounded-[10px] overflow-hidden border-2 transition-all ${img.isCardImage ? 'border-[#c1a0fd] ring-2 ring-[#c1a0fd]/30' : 'border-transparent hover:border-[#c1a0fd]/50 cursor-pointer'}`}
                                >
                                  <img src={src} alt={img.serviceTitle} className="w-full h-full object-cover" />
                                  {img.isCardImage && (
                                    <div className="absolute top-1 right-1 w-5 h-5 bg-[#c1a0fd] rounded-full flex items-center justify-center">
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"/>
                                      </svg>
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 gap-3 border-t border-[#e0e2ef] pt-6">
                      <div className="text-center p-3 bg-[#f2f4fc] rounded-[12px]">
                        <p className="text-[18px] font-bold text-[#c1a0fd]">{stats?.averageRating ?? '-'}</p>
                        <p className="text-[11px] text-[#111125]/40 mt-0.5">Note</p>
                      </div>
                      <div className="text-center p-3 bg-[#f2f4fc] rounded-[12px]">
                        <p className="text-[18px] font-bold text-[#c1a0fd]">{stats?.totalReviews ?? '-'}</p>
                        <p className="text-[11px] text-[#111125]/40 mt-0.5">Avis</p>
                      </div>
                      <div className="text-center p-3 bg-[#f2f4fc] rounded-[12px]">
                        <p className="text-[18px] font-bold text-[#c1a0fd]">{stats?.totalBookings ?? '-'}</p>
                        <p className="text-[11px] text-[#111125]/40 mt-0.5">Réservations</p>
                      </div>
                      <div className="text-center p-3 bg-[#f2f4fc] rounded-[12px]">
                        <p className="text-[18px] font-bold text-[#c1a0fd]">{stats?.activeServices ?? services.filter(s => s.active).length}</p>
                        <p className="text-[11px] text-[#111125]/40 mt-0.5">Offres actives</p>
                      </div>
                    </div>

                    {/* View Public Profile */}
                    <button
                      onClick={() => navigate(`/kooker/${user?.kookerProfileId}`)}
                      className="w-full mt-6 flex items-center justify-center gap-2 h-[44px] bg-[#f2f4fc] hover:bg-[#e8eaf5] text-[#111125] font-medium text-[13px] rounded-[12px] transition-all"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1.33333 8.00004C1.33333 8.00004 3.33333 3.33337 8 3.33337C12.6667 3.33337 14.6667 8.00004 14.6667 8.00004C14.6667 8.00004 12.6667 12.6667 8 12.6667C3.33333 12.6667 1.33333 8.00004 1.33333 8.00004Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2"/>
                      </svg>
                      Voir mon profil public
                    </button>
                  </div>
                </div>

                {/* Right: Edit Form */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Bio */}
                  <div className="bg-white rounded-[20px] p-6 shadow-sm">
                    <h4 className="text-[15px] font-semibold text-[#111125] mb-4">Biographie</h4>
                    <textarea
                      value={profile.bio}
                      onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
                      rows={5}
                      className="w-full px-4 py-3 bg-[#f2f4fc] border border-[#e0e2ef] rounded-[12px] text-[14px] text-[#111125] placeholder:text-[#111125]/30 focus:outline-none focus:border-[#c1a0fd] focus:ring-2 focus:ring-[#c1a0fd]/20 transition-all resize-none leading-relaxed"
                      placeholder="Décrivez votre parcours, vos passions culinaires, ce qui rend votre cuisine unique..."
                    />
                    <p className="text-[12px] text-[#111125]/35 mt-2">{profile.bio.length} / 500 caractères</p>
                  </div>

                  {/* Specialties */}
                  <div className="bg-white rounded-[20px] p-6 shadow-sm">
                    <h4 className="text-[15px] font-semibold text-[#111125] mb-2">Spécialités</h4>
                    <p className="text-[13px] text-[#111125]/50 mb-4">Sélectionnez vos spécialités culinaires.</p>
                    <div className="flex flex-wrap gap-2">
                      {allSpecialties.map(specialty => (
                        <button
                          key={specialty}
                          onClick={() => toggleSpecialty(specialty)}
                          className={`px-3.5 py-2 rounded-[10px] text-[13px] font-medium transition-all ${
                            profile.specialties.includes(specialty)
                              ? 'bg-[#c1a0fd] text-white'
                              : 'bg-[#f2f4fc] text-[#111125]/60 hover:bg-[#e8eaf5] hover:text-[#111125]'
                          }`}
                        >
                          {specialty}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="bg-white rounded-[20px] p-6 shadow-sm">
                    <h4 className="text-[15px] font-semibold text-[#111125] mb-4">Informations</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-[13px] font-medium text-[#111125] mb-1.5">Type d'activité</label>
                        <select
                          value={profile.type}
                          onChange={(e) => setProfile(prev => ({ ...prev, type: e.target.value }))}
                          className="w-full h-[48px] px-4 bg-[#f2f4fc] border border-[#e0e2ef] rounded-[12px] text-[14px] text-[#111125] focus:outline-none focus:border-[#c1a0fd] focus:ring-2 focus:ring-[#c1a0fd]/20 transition-all appearance-none cursor-pointer"
                        >
                          <option>Chef à domicile</option>
                          <option>Traiteur</option>
                          <option>Pâtissier</option>
                          <option>Cuisinier amateur</option>
                          <option>Cours de cuisine</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[13px] font-medium text-[#111125] mb-1.5">Ville</label>
                        <input
                          type="text"
                          value={profile.city}
                          onChange={(e) => setProfile(prev => ({ ...prev, city: e.target.value }))}
                          className="w-full h-[48px] px-4 bg-[#f2f4fc] border border-[#e0e2ef] rounded-[12px] text-[14px] text-[#111125] placeholder:text-[#111125]/30 focus:outline-none focus:border-[#c1a0fd] focus:ring-2 focus:ring-[#c1a0fd]/20 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[13px] font-medium text-[#111125] mb-1.5">Expérience</label>
                        <input
                          type="text"
                          value={profile.experience}
                          onChange={(e) => setProfile(prev => ({ ...prev, experience: e.target.value }))}
                          placeholder="ex: 5 ans"
                          className="w-full h-[48px] px-4 bg-[#f2f4fc] border border-[#e0e2ef] rounded-[12px] text-[14px] text-[#111125] placeholder:text-[#111125]/30 focus:outline-none focus:border-[#c1a0fd] focus:ring-2 focus:ring-[#c1a0fd]/20 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[13px] font-medium text-[#111125] mb-1.5">Téléphone</label>
                        <input
                          type="tel"
                          value={profile.phone}
                          onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="06 12 34 56 78"
                          className="w-full h-[48px] px-4 bg-[#f2f4fc] border border-[#e0e2ef] rounded-[12px] text-[14px] text-[#111125] placeholder:text-[#111125]/30 focus:outline-none focus:border-[#c1a0fd] focus:ring-2 focus:ring-[#c1a0fd]/20 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[13px] font-medium text-[#111125] mb-1.5">Adresse</label>
                        <input
                          type="text"
                          value={profile.address}
                          onChange={(e) => setProfile(prev => ({ ...prev, address: e.target.value }))}
                          placeholder="Votre adresse"
                          className="w-full h-[48px] px-4 bg-[#f2f4fc] border border-[#e0e2ef] rounded-[12px] text-[14px] text-[#111125] placeholder:text-[#111125]/30 focus:outline-none focus:border-[#c1a0fd] focus:ring-2 focus:ring-[#c1a0fd]/20 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={handleProfileCancel}
                      className="px-6 py-3 text-[14px] font-medium text-[#111125]/50 hover:text-[#111125] bg-white border border-[#e0e2ef] hover:border-[#111125]/20 rounded-[12px] transition-all"
                    >
                      Annuler les modifications
                    </button>
                    <button
                      onClick={handleProfileSave}
                      disabled={profileSaving}
                      className="px-8 py-3 text-[14px] font-semibold text-white bg-[#c1a0fd] hover:bg-[#b090ed] rounded-[12px] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {profileSaving ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Sauvegarde...
                        </>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M13.3333 4.66663L6 12L2.66667 8.66663" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Sauvegarder
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    {/* ── Delete service confirmation modal ── */}
    {pendingDeleteServiceId && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111125]/30 backdrop-blur-sm px-4">
        <div className="bg-white rounded-[20px] p-8 w-full max-w-[400px] shadow-xl border border-[#e0e2ef]">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#f3ecff] mx-auto mb-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c1a0fd" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </div>
          <h3 className="text-[18px] font-bold text-[#111125] text-center mb-2 tracking-[-0.3px]">
            Supprimer cette offre ?
          </h3>
          <p className="text-[13px] text-[#6b7280] text-center leading-relaxed mb-7">
            Cette action est irréversible.<br />L'offre sera définitivement supprimée.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setPendingDeleteServiceId(null)}
              className="flex-1 h-[48px] rounded-[12px] border border-[#e0e2ef] text-[14px] font-medium text-[#6b7280] hover:border-[#c1a0fd] hover:text-[#111125] transition-all"
            >
              Annuler
            </button>
            <button
              onClick={confirmDeleteService}
              className="flex-1 h-[48px] rounded-[12px] bg-[#111125] hover:bg-[#1e1e38] text-white text-[14px] font-semibold transition-all"
            >
              Supprimer
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Refusal modal ── */}

    {pendingAcceptance && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111125]/30 backdrop-blur-sm px-4">
        <div className="bg-white rounded-[20px] p-8 w-full max-w-[440px] shadow-xl border border-[#e0e2ef]">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#f3ecff] mx-auto mb-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c1a0fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h3 className="text-[18px] font-bold text-[#111125] text-center mb-1">Accepter cette réservation ?</h3>
          <p className="text-[13px] text-[#6b7280] text-center mb-6">Le client sera notifié par message et par e-mail.</p>

          <div className="bg-[#f2f4fc] rounded-[14px] px-5 py-4 mb-7 space-y-2">
            <div className="flex justify-between text-[13px]">
              <span className="text-[#6b7280]">Client</span>
              <span className="font-semibold text-[#111125]">{pendingAcceptance.clientName}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-[#6b7280]">Prestation</span>
              <span className="font-semibold text-[#111125] text-right max-w-[60%]">{pendingAcceptance.serviceTitle}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-[#6b7280]">Date</span>
              <span className="font-semibold text-[#111125]">
                {new Date(pendingAcceptance.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {pendingAcceptance.startTime.slice(0, 5)}
              </span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-[#6b7280]">Convives</span>
              <span className="font-semibold text-[#111125]">{pendingAcceptance.guests} personne{pendingAcceptance.guests > 1 ? 's' : ''}</span>
            </div>
            <div className="h-px bg-[#e0e2ef] my-1" />
            <div className="flex justify-between text-[14px]">
              <span className="font-semibold text-[#111125]">Montant</span>
              <span className="font-bold text-[#c1a0fd]">{formatPrice(pendingAcceptance.totalPriceInCents)}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setPendingAcceptance(null)}
              className="flex-1 h-[48px] rounded-[12px] border border-[#e0e2ef] text-[14px] font-medium text-[#6b7280] hover:border-[#c1a0fd] hover:text-[#111125] transition-all"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirmAcceptance}
              className="flex-1 h-[48px] rounded-[12px] bg-[#c1a0fd] hover:bg-[#b090ed] text-white text-[14px] font-semibold transition-all"
            >
              Confirmer l'acceptation
            </button>
          </div>
        </div>
      </div>
    )}

    {pendingRefusal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="bg-white rounded-[20px] p-6 w-full max-w-[480px] shadow-xl">
          <h3 className="text-[18px] font-bold text-[#111125] mb-1">Refuser la réservation</h3>
          <p className="text-[13px] text-[#6b7280] mb-5">
            Choisissez une raison — un message sera automatiquement envoyé au client.
          </p>

          <div className="space-y-2.5 mb-5">
            {REFUSAL_REASONS.map((reason) => (
              <label
                key={reason.id}
                className={`flex items-start gap-3 p-3 rounded-[12px] border cursor-pointer transition-all ${
                  refusalReasonId === reason.id
                    ? 'border-[#c1a0fd] bg-[#f3ecff]'
                    : 'border-[#e5e7eb] hover:border-[#c1a0fd]'
                }`}
              >
                <input
                  type="radio"
                  name="refusalReason"
                  value={reason.id}
                  checked={refusalReasonId === reason.id}
                  onChange={() => setRefusalReasonId(reason.id)}
                  className="mt-0.5 accent-[#c1a0fd] flex-shrink-0"
                />
                <div>
                  <p className="text-[14px] font-medium text-[#111125]">{reason.label}</p>
                  {reason.id !== 'custom' && (
                    <p className="text-[12px] text-[#6b7280] mt-0.5 italic">"{reason.message}"</p>
                  )}
                </div>
              </label>
            ))}
          </div>

          {refusalReasonId === 'custom' && (
            <textarea
              value={refusalCustom}
              onChange={(e) => setRefusalCustom(e.target.value)}
              placeholder="Expliquez la raison du refus..."
              rows={3}
              className="w-full rounded-[12px] border border-[#e5e7eb] px-4 py-3 text-[14px] text-[#111125] placeholder-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#c1a0fd] focus:border-transparent resize-none mb-5"
            />
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { setPendingRefusal(null); setRefusalReasonId('unavailable'); setRefusalCustom(''); }}
              className="flex-1 h-[48px] rounded-[12px] border border-[#e5e7eb] text-[14px] font-medium text-[#6b7280] hover:border-[#c1a0fd] hover:text-[#111125] transition-all"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirmRefusal}
              disabled={refusalReasonId === 'custom' && !refusalCustom.trim()}
              className="flex-1 h-[48px] rounded-[12px] bg-red-500 text-white text-[14px] font-semibold hover:bg-red-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Confirmer le refus
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default KookerDashboardPage;
