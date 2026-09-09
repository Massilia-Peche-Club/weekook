import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface IngredientItem { name: string; quantity: string; unit: string; }

interface BookingDetail {
  id: number;
  userId: number;
  kookerProfileId: number;
  serviceId: number;
  date: string;
  startTime: string;
  endTime: string | null;
  guests: number;
  totalPriceInCents: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'awaiting_confirmation';
  paymentStatus?: string;
  notes: string | null;
  ingredientsSource?: string;
  createdAt: string;
  service: {
    id: number;
    title: string;
    type: unknown;
    priceInCents: number;
    durationMinutes: number;
    description: string | null;
    koursDifficulty?: string | null;
    koursLocation?: string | null;
    equipmentProvided?: boolean;
    ingredientsList?: unknown;
    ingredientsBaseServings?: number | null;
    ingredientsPricePerGuestInCents?: number | null;
  };
  kookerProfile: {
    id: number;
    user: { id: number; firstName: string; lastName: string; avatar: string | null };
  };
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    avatar: string | null;
    phone: string | null;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

function formatDateLong(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatDateInput(dateStr: string) {
  return new Date(dateStr).toISOString().slice(0, 10);
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

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:                { label: 'En attente',                  color: '#d97706', bg: '#fef3c7' },
  confirmed:              { label: 'Confirmée',                   color: '#16a34a', bg: '#dcfce7' },
  awaiting_confirmation:  { label: 'En attente de confirmation',  color: '#d97706', bg: '#fef3c7' },
  cancelled:              { label: 'Annulée',                     color: '#dc2626', bg: '#fee2e2' },
  completed:              { label: 'Terminée',                    color: '#6b7280', bg: '#f3f4f6' },
};

const PAYMENT_STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  none:                    { label: '',                  color: '', bg: '' },
  pending_authorization:   { label: 'Paiement en cours', color: '#d97706', bg: '#fef3c7' },
  authorized:              { label: 'Pré-autorisé',      color: '#d97706', bg: '#fff7ed' },
  captured:                { label: 'Payé',              color: '#16a34a', bg: '#dcfce7' },
  transferred:             { label: 'Versé au kooker',   color: '#16a34a', bg: '#d1fae5' },
  cancelled:               { label: 'Annulé',            color: '#6b7280', bg: '#f3f4f6' },
  refunded:                { label: 'Remboursé',         color: '#6b7280', bg: '#f3f4f6' },
};

function Avatar({ firstName, lastName, avatar, size = 48 }: { firstName: string; lastName: string; avatar: string | null; size?: number }) {
  const initials = ((firstName?.[0] || '') + (lastName?.[0] || '')).toUpperCase();
  return avatar ? (
    <img src={avatar} alt={firstName} style={{ width: size, height: size }} className="rounded-full object-cover flex-shrink-0" />
  ) : (
    <div style={{ width: size, height: size, fontSize: size * 0.36 }} className="rounded-full bg-gradient-to-br from-[#c1a0fd] to-[#8b6fce] flex items-center justify-center text-white font-bold flex-shrink-0">
      {initials}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editGuests, setEditGuests] = useState(1);
  const [editNotes, setEditNotes] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [hasReview, setHasReview] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHovered, setReviewHovered] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Kooker review state (kooker_to_user)
  const [showKookerReviewModal, setShowKookerReviewModal] = useState(false);
  const [kookerHasReviewed, setKookerHasReviewed] = useState(false);
  const [userHasReviewed, setUserHasReviewed] = useState(false);
  const [kookerReviewRating, setKookerReviewRating] = useState(0);
  const [kookerReviewHovered, setKookerReviewHovered] = useState(0);
  const [kookerReviewComment, setKookerReviewComment] = useState('');
  const [kookerReviewSubmitting, setKookerReviewSubmitting] = useState(false);
  const [confirmingCompletion, setConfirmingCompletion] = useState(false);

  const [showTestimonialModal, setShowTestimonialModal] = useState(false);
  const [testimonialName, setTestimonialName] = useState('');
  const [testimonialRole, setTestimonialRole] = useState('');
  const [testimonialContent, setTestimonialContent] = useState('');
  const [testimonialRating, setTestimonialRating] = useState(5);
  const [testimonialHovered, setTestimonialHovered] = useState(0);
  const [testimonialSubmitting, setTestimonialSubmitting] = useState(false);
  const [testimonialSent, setTestimonialSent] = useState(false);

  // Kooker action modals
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRefuseModal, setShowRefuseModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [refusalReasonId, setRefusalReasonId] = useState('unavailable');
  const [refusalCustom, setRefusalCustom] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get<BookingDetail>(`/bookings/${id}`)
      .then(res => {
        if (res.success && res.data) {
          setBooking(res.data);
          setEditDate(formatDateInput(res.data.date));
          setEditTime(String(res.data.startTime).slice(0, 5));
          setEditGuests(res.data.guests);
          setEditNotes(res.data.notes || '');
        }
      })
      .catch(() => toast.error('Réservation introuvable'))
      .finally(() => setLoading(false));
  }, [id]);

  // Fetch booking reviews when completed (for kooker-to-user review feature)
  useEffect(() => {
    if (!booking || booking.status !== 'completed') return;
    api.get<{ success: boolean; data: Array<{ id: number; type: string; userId: number; rating: number; comment?: string }> }>(`/reviews/booking/${booking.id}`)
      .then((res: any) => {
        const reviews: Array<{ id: number; type: string }> = res.data || res;
        if (Array.isArray(reviews)) {
          setUserHasReviewed(reviews.some(r => r.type === 'user_to_kooker'));
          setKookerHasReviewed(reviews.some(r => r.type === 'kooker_to_user'));
        }
      })
      .catch(() => { /* silently ignore */ });
  }, [booking?.id, booking?.status]);

  if (!booking) {
    return (
      <div className="min-h-screen bg-[#f2f4fc] flex items-center justify-center">
        {loading ? (
          <div className="w-8 h-8 border-2 border-[#c1a0fd] border-t-transparent rounded-full animate-spin" />
        ) : (
          <p className="text-[#6b7280]">Réservation introuvable.</p>
        )}
      </div>
    );
  }

  const isOwner = booking.userId === user?.id;
  const isKooker = user?.kookerProfileId != null && booking.kookerProfileId === user.kookerProfileId;
  const isKours = Array.isArray(booking.service.type)
    ? (booking.service.type as string[]).includes('COURS')
    : String(booking.service.type).includes('COURS');
  const canEdit = isOwner
    ? booking.status === 'pending'
    : isKooker
      ? booking.status !== 'completed' && booking.status !== 'cancelled' && booking.status !== 'awaiting_confirmation'
      : false;

  const statusInfo = STATUS_LABELS[booking.status] || STATUS_LABELS.pending;
  const kookerUser = booking.kookerProfile.user;
  const clientUser = booking.user;
  const otherPersonId = isOwner ? kookerUser.id : clientUser.id;

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        date: editDate,
        startTime: editTime,
        notes: editNotes || null,
      };
      if (isOwner) body.guests = editGuests;

      const res = await api.put<BookingDetail>(`/bookings/${id}`, body);
      if (res.success && res.data) {
        setBooking(res.data);
        setEditMode(false);
        toast.success('Réservation modifiée — l\'autre partie a été notifiée.');
      }
    } catch (err: unknown) {
      const e = err as { error?: string };
      toast.error(e?.error || 'Erreur lors de la modification');
    } finally {
      setSaving(false);
    }
  };

  const openTestimonialModal = () => {
    setTestimonialName(user ? `${user.firstName} ${user.lastName}` : '');
    setTestimonialRole('');
    setTestimonialContent('');
    setTestimonialRating(5);
    setShowTestimonialModal(true);
  };

  const handleSubmitTestimonial = async () => {
    if (!testimonialContent.trim() || testimonialContent.trim().length < 10) return;
    setTestimonialSubmitting(true);
    try {
      await api.post('/testimonials', {
        authorName: testimonialName.trim(),
        authorRole: testimonialRole.trim() || undefined,
        content: testimonialContent.trim(),
        rating: testimonialRating,
      });
      setTestimonialSent(true);
      setShowTestimonialModal(false);
      toast.success('Merci ! Votre témoignage sera visible après validation par notre équipe.');
    } catch (err: unknown) {
      const e = err as { error?: string };
      toast.error(e?.error || 'Erreur lors de l\'envoi');
    } finally {
      setTestimonialSubmitting(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!booking || reviewRating === 0) return;
    setReviewSubmitting(true);
    try {
      await api.post('/reviews', {
        bookingId: booking.id,
        kookerProfileId: booking.kookerProfileId,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });
      setHasReview(true);
      setShowReviewModal(false);
      toast.success('Avis publié — merci !');
    } catch (err: unknown) {
      const e = err as { error?: string };
      toast.error(e?.error || 'Erreur lors de la publication');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditDate(formatDateInput(booking.date));
    setEditTime(String(booking.startTime).slice(0, 5));
    setEditGuests(booking.guests);
    setEditNotes(booking.notes || '');
    setEditMode(false);
  };

  // ── Kooker actions ──

  const handleAcceptBooking = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await api.put(`/bookings/${id}/status`, { status: 'confirmed' });
      setBooking(prev => prev ? { ...prev, status: 'confirmed' } : prev);
      setShowAcceptModal(false);
      toast.success('Réservation confirmée — le client a été notifié.');
    } catch (err: unknown) {
      const e = err as { error?: string };
      toast.error(e?.error || 'Erreur lors de la confirmation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefuseBooking = async () => {
    if (!id || !booking) return;
    const reason = REFUSAL_REASONS.find(r => r.id === refusalReasonId);
    const messageContent = refusalReasonId === 'custom'
      ? refusalCustom.trim()
      : reason?.message || '';
    if (!messageContent) {
      toast.error('Veuillez préciser la raison du refus.');
      return;
    }
    setActionLoading(true);
    try {
      await api.put(`/bookings/${id}/status`, { status: 'cancelled' });
      await api.post('/messages', {
        receiverId: booking.user.id,
        content: `Votre réservation a été refusée.\n\nRaison : ${messageContent}`,
        serviceId: booking.serviceId,
      });
      setBooking(prev => prev ? { ...prev, status: 'cancelled' } : prev);
      setShowRefuseModal(false);
      setRefusalReasonId('unavailable');
      setRefusalCustom('');
      toast.success('Réservation refusée — le client a été notifié par message.');
    } catch (err: unknown) {
      const e = err as { error?: string };
      toast.error(e?.error || 'Erreur lors du refus');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteBooking = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await api.put(`/bookings/${id}/status`, { status: 'completed' });
      setBooking(prev => prev ? { ...prev, status: 'completed' } : prev);
      setShowCompleteModal(false);
      toast.success('Réservation marquée comme terminée.');
    } catch (err: unknown) {
      const e = err as { error?: string };
      toast.error(e?.error || 'Erreur lors de la mise à jour');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await api.put(`/bookings/${id}/cancel`, {});
      setBooking(prev => prev ? { ...prev, status: 'cancelled' } : prev);
      setShowCancelModal(false);
      toast.success('Réservation annulée.');
    } catch (err: unknown) {
      const e = err as { error?: string };
      toast.error(e?.error || 'Erreur lors de l\'annulation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmCompletion = async () => {
    if (!id) return;
    setConfirmingCompletion(true);
    try {
      await api.put<{ success: boolean }>(`/bookings/${id}/confirm-completion`);
      setBooking(prev => prev ? { ...prev, status: 'completed' } : prev);
      toast.success('Prestation confirmée ! Laissez un avis sur votre expérience.');
      // Open review modal immediately
      setShowReviewModal(true);
      setReviewRating(0);
      setReviewComment('');
    } catch (err: unknown) {
      const e = err as { error?: string };
      toast.error(e?.error || 'Erreur lors de la confirmation');
    } finally {
      setConfirmingCompletion(false);
    }
  };

  const handleSubmitKookerReview = async () => {
    if (!booking || kookerReviewRating === 0) return;
    setKookerReviewSubmitting(true);
    try {
      await api.post('/reviews/kooker-to-user', {
        bookingId: booking.id,
        rating: kookerReviewRating,
        comment: kookerReviewComment.trim() || undefined,
      });
      setKookerHasReviewed(true);
      setShowKookerReviewModal(false);
      toast.success('Avis sur le client publié — merci !');
    } catch (err: unknown) {
      const e = err as { error?: string };
      toast.error(e?.error || 'Erreur lors de la publication');
    } finally {
      setKookerReviewSubmitting(false);
    }
  };

  document.title = `Réservation #${booking.id.toString().padStart(5, '0')} — Weekook`;

  return (
    <div className="min-h-screen bg-[#f2f4fc]" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="px-4 md:px-8 lg:px-[96px] py-8">

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[#6b7280] hover:text-[#111125] text-[14px] font-medium mb-6 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          Retour
        </button>

        <div className="max-w-[680px] mx-auto">

          {/* ── Header card ── */}
          <div className="bg-white rounded-[20px] p-6 md:p-8 shadow-sm mb-4">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <Avatar
                  firstName={kookerUser.firstName}
                  lastName={kookerUser.lastName}
                  avatar={kookerUser.avatar}
                  size={52}
                />
                <div>
                  <div className="flex flex-wrap items-center gap-2 leading-tight mb-0.5">
                    <h1 className="text-[20px] font-bold text-[#111125]">{booking.service.title}</h1>
                    {isKours
                      ? <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-bold bg-[#c1a0fd] text-white">COURS</span>
                      : <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-bold bg-[#7c5cbf] text-white">KOOK</span>}
                  </div>
                  <button
                    onClick={() => navigate(`/kooker/${booking.kookerProfileId}`)}
                    className="text-[14px] text-[#c1a0fd] hover:underline mt-0.5 block"
                  >
                    avec {kookerUser.firstName} {kookerUser.lastName}
                  </button>
                  <p className="text-[12px] text-[#9ca3af] mt-0.5">
                    Réservation #{String(booking.id).padStart(5, '0')} · créée le {new Date(booking.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 flex-shrink-0">
                <span
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-full"
                  style={{ color: statusInfo.color, backgroundColor: statusInfo.bg }}
                >
                  {statusInfo.label}
                </span>
                {booking.paymentStatus && booking.paymentStatus !== 'none' && PAYMENT_STATUS_LABELS[booking.paymentStatus] && (
                  <span
                    className="text-[12px] font-semibold px-3 py-1.5 rounded-full"
                    style={{ color: PAYMENT_STATUS_LABELS[booking.paymentStatus].color, backgroundColor: PAYMENT_STATUS_LABELS[booking.paymentStatus].bg }}
                  >
                    {PAYMENT_STATUS_LABELS[booking.paymentStatus].label}
                  </span>
                )}
              </div>
            </div>

            {/* Details grid */}
            <div className="bg-[#f2f4fc] rounded-[14px] divide-y divide-[#e0e2ef]">
              {[
                {
                  icon: <path d="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18"/>,
                  label: 'Date',
                  value: formatDateLong(booking.date),
                },
                {
                  icon: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
                  label: 'Heure',
                  value: String(booking.startTime).slice(0, 5),
                },
                {
                  icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
                  label: isKours ? 'Participants' : 'Convives',
                  value: `${booking.guests} personne${booking.guests > 1 ? 's' : ''}`,
                },
                {
                  icon: <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></>,
                  label: 'Montant total',
                  value: formatPrice(booking.totalPriceInCents),
                  bold: true,
                  purple: true,
                },
              ].map(({ icon, label, value, bold, purple }) => (
                <div key={label} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {icon}
                    </svg>
                    <span className="text-[13px] text-[#6b7280]">{label}</span>
                  </div>
                  <span className={`text-[13px] ${bold ? 'font-bold text-[15px]' : 'font-semibold'} ${purple ? 'text-[#c1a0fd]' : 'text-[#111125]'}`}>
                    {value}
                  </span>
                </div>
              ))}
              {booking.service.durationMinutes && (
                <div className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span className="text-[13px] text-[#6b7280]">Durée estimée</span>
                  </div>
                  <span className="text-[13px] font-semibold text-[#111125]">{booking.service.durationMinutes} min</span>
                </div>
              )}
              {isKours && booking.service.koursDifficulty && (
                <div className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
                    </svg>
                    <span className="text-[13px] text-[#6b7280]">Niveau</span>
                  </div>
                  <span className="text-[13px] font-semibold text-[#111125]">🎓 {booking.service.koursDifficulty}</span>
                </div>
              )}
              {isKours && booking.service.koursLocation && (
                <div className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span className="text-[13px] text-[#6b7280]">Lieu du cours</span>
                  </div>
                  <span className="text-[13px] font-semibold text-[#111125]">📍 {booking.service.koursLocation}</span>
                </div>
              )}
              {/* Ingrédients */}
              {booking.ingredientsSource && (
                <div className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 2l1.5 5.5A8 8 0 0 0 12 20a8 8 0 0 0 7.5-12.5L21 2"/><path d="M12 20v2"/>
                    </svg>
                    <span className="text-[13px] text-[#6b7280]">Ingrédients</span>
                  </div>
                  <span className="text-[13px] font-semibold text-[#111125]">
                    {booking.ingredientsSource === 'kooker' ? '👨‍🍳 Fournis par le kooker' : '🛒 Achetés par le client'}
                  </span>
                </div>
              )}
              {/* Surcoût ingrédients */}
              {booking.ingredientsSource === 'kooker' && booking.service.ingredientsPricePerGuestInCents && booking.service.ingredientsPricePerGuestInCents > 0 && (
                <div className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                    </svg>
                    <span className="text-[13px] text-[#6b7280]">Dont courses ({booking.guests} × {((booking.service.ingredientsPricePerGuestInCents) / 100).toFixed(2).replace('.', ',')} €)</span>
                  </div>
                  <span className="text-[13px] font-semibold text-[#111125]">
                    {((booking.service.ingredientsPricePerGuestInCents * booking.guests) / 100).toFixed(2).replace('.', ',')} €
                  </span>
                </div>
              )}
            </div>

            {/* Liste ingrédients (si client achète) */}
            {booking.ingredientsSource !== 'kooker' && (() => {
              const rawList = booking.service.ingredientsList;
              const list: IngredientItem[] = Array.isArray(rawList) ? rawList as IngredientItem[] : (rawList ? (() => { try { return JSON.parse(String(rawList)); } catch { return []; } })() : []);
              if (!list.length) return null;
              return (
                <div className="mt-4 p-4 bg-[#f2f4fc] rounded-[14px]">
                  <p className="text-[12px] text-[#6b7280] font-semibold uppercase tracking-wide mb-2">
                    🛒 Liste de courses
                    {booking.service.ingredientsBaseServings && (
                      <span className="font-normal normal-case ml-1">· quantités pour {booking.service.ingredientsBaseServings} pers.</span>
                    )}
                  </p>
                  <div className="space-y-1.5">
                    {list.map((ing, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 bg-white rounded-[8px] px-3 py-2">
                        <span className="text-[13px] font-medium text-[#111125]">{ing.name}</span>
                        <span className="text-[13px] text-[#c1a0fd] font-semibold shrink-0">{ing.quantity} {ing.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Notes */}
            {booking.notes && !editMode && (
              <div className="mt-4 p-4 bg-[#f2f4fc] rounded-[14px]">
                <p className="text-[12px] text-[#6b7280] font-semibold uppercase tracking-wide mb-1.5">Notes</p>
                <p className="text-[14px] text-[#111125] leading-relaxed whitespace-pre-wrap">{booking.notes}</p>
              </div>
            )}

            {/* Client info (visible to kooker) */}
            {isKooker && (
              <div className="mt-4 p-4 bg-[#f2f4fc] rounded-[14px]">
                <p className="text-[12px] text-[#6b7280] font-semibold uppercase tracking-wide mb-3">Client</p>
                <div className="flex items-center gap-3">
                  <Avatar firstName={clientUser.firstName} lastName={clientUser.lastName} avatar={clientUser.avatar} size={36} />
                  <div>
                    <p className="text-[14px] font-semibold text-[#111125]">{clientUser.firstName} {clientUser.lastName}</p>
                    <p className="text-[12px] text-[#6b7280]">{clientUser.email}</p>
                    {clientUser.phone && <p className="text-[12px] text-[#6b7280]">{clientUser.phone}</p>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Edit form ── */}
          {canEdit && (
            <div className="bg-white rounded-[20px] p-6 md:p-8 shadow-sm mb-4">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[16px] font-bold text-[#111125]">
                  {editMode ? 'Modifier la réservation' : 'Modification possible'}
                </h2>
                {!editMode && (
                  <button
                    onClick={() => setEditMode(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#f3ecff] text-[#c1a0fd] text-[13px] font-semibold rounded-[10px] hover:bg-[#ebe0ff] transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Modifier
                  </button>
                )}
              </div>

              {!editMode && (
                <p className="text-[13px] text-[#6b7280]">
                  {isOwner
                    ? 'Vous pouvez modifier la date, l\'heure, le nombre de convives et les notes tant que la réservation est en attente.'
                    : 'Vous pouvez modifier la date, l\'heure et les notes tant que la réservation n\'est pas terminée.'}
                </p>
              )}

              {editMode && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[13px] font-semibold text-[#111125] mb-1.5">Date</label>
                      <input
                        type="date"
                        value={editDate}
                        onChange={e => setEditDate(e.target.value)}
                        min={new Date().toISOString().slice(0, 10)}
                        className="w-full h-[44px] rounded-[12px] border border-[#e0e2ef] px-4 text-[14px] text-[#111125] focus:outline-none focus:ring-2 focus:ring-[#c1a0fd] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-semibold text-[#111125] mb-1.5">Heure</label>
                      <input
                        type="time"
                        value={editTime}
                        onChange={e => setEditTime(e.target.value)}
                        className="w-full h-[44px] rounded-[12px] border border-[#e0e2ef] px-4 text-[14px] text-[#111125] focus:outline-none focus:ring-2 focus:ring-[#c1a0fd] focus:border-transparent"
                      />
                    </div>
                  </div>

                  {isOwner && (
                    <div>
                      <label className="block text-[13px] font-semibold text-[#111125] mb-1.5">{isKours ? 'Nombre de participants' : 'Nombre de convives'}</label>
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={editGuests}
                        onChange={e => setEditGuests(parseInt(e.target.value, 10) || 1)}
                        className="w-full h-[44px] rounded-[12px] border border-[#e0e2ef] px-4 text-[14px] text-[#111125] focus:outline-none focus:ring-2 focus:ring-[#c1a0fd] focus:border-transparent"
                      />
                      {editGuests !== booking.guests && (
                        <p className="text-[12px] text-[#c1a0fd] mt-1">
                          Nouveau montant estimé : {formatPrice(booking.service.priceInCents * editGuests)}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-[13px] font-semibold text-[#111125] mb-1.5">Notes</label>
                    <textarea
                      value={editNotes}
                      onChange={e => setEditNotes(e.target.value)}
                      placeholder="Instructions particulières, allergies, préférences..."
                      rows={3}
                      className="w-full rounded-[12px] border border-[#e0e2ef] px-4 py-3 text-[14px] text-[#111125] placeholder-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#c1a0fd] focus:border-transparent resize-none"
                    />
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={handleCancelEdit}
                      className="flex-1 h-[48px] rounded-[12px] border border-[#e0e2ef] text-[14px] font-medium text-[#6b7280] hover:border-[#c1a0fd] hover:text-[#111125] transition-all"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 h-[48px] rounded-[12px] bg-[#c1a0fd] hover:bg-[#b090ed] text-white text-[14px] font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      {saving ? (
                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Enregistrement…</>
                      ) : 'Sauvegarder les modifications'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Actions ── */}
          <div className="bg-white rounded-[20px] p-6 md:p-8 shadow-sm mb-4">
            <h2 className="text-[16px] font-bold text-[#111125] mb-4">Actions</h2>
            <div className="flex flex-wrap gap-3">

              {/* Kooker: Accept pending booking */}
              {isKooker && booking.status === 'pending' && (
                <button
                  onClick={() => setShowAcceptModal(true)}
                  className="flex items-center gap-2 px-5 py-3 bg-[#c1a0fd] hover:bg-[#b090ed] text-white text-[14px] font-semibold rounded-[12px] transition-all shadow-sm"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  Accepter
                </button>
              )}

              {/* Kooker: Refuse pending booking */}
              {isKooker && booking.status === 'pending' && (
                <button
                  onClick={() => { setShowRefuseModal(true); setRefusalReasonId('unavailable'); setRefusalCustom(''); }}
                  className="flex items-center gap-2 px-5 py-3 bg-white border border-[#fca5a5] text-[#ef4444] text-[14px] font-semibold rounded-[12px] hover:bg-[#fee2e2] transition-all shadow-sm"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  Refuser
                </button>
              )}

              {/* Owner: Confirm completion when awaiting_confirmation */}
              {isOwner && booking.status === 'awaiting_confirmation' && (
                <button
                  onClick={handleConfirmCompletion}
                  disabled={confirmingCompletion}
                  className="flex items-center gap-2 px-5 py-3 bg-[#16a34a] hover:bg-[#15803d] text-white text-[14px] font-semibold rounded-[12px] transition-all shadow-sm disabled:opacity-40"
                >
                  {confirmingCompletion ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Confirmation...</>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                      </svg>
                      Confirmer la réalisation
                    </>
                  )}
                </button>
              )}

              {/* Contact button */}
              <button
                onClick={() => navigate(`/messagerie?to=${otherPersonId}&service=${booking.serviceId}`)}
                className="flex items-center gap-2 px-5 py-3 bg-white border border-[#e0e2ef] text-[#111125] text-[14px] font-semibold rounded-[12px] hover:border-[#c1a0fd] hover:text-[#c1a0fd] transition-all shadow-sm"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Contacter {isOwner ? kookerUser.firstName : clientUser.firstName}
              </button>

              {/* Owner: Leave review */}
              {isOwner && booking.status === 'completed' && (
                hasReview
                  ? <span className="flex items-center gap-1.5 px-5 py-3 text-[14px] font-semibold text-green-600 bg-white border border-green-200 rounded-[12px] shadow-sm">✓ Avis laissé</span>
                  : <button
                      onClick={() => { setShowReviewModal(true); setReviewRating(0); setReviewComment(''); }}
                      className="flex items-center gap-2 px-5 py-3 bg-[#c1a0fd] hover:bg-[#b090ed] text-white text-[14px] font-semibold rounded-[12px] transition-all shadow-sm"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                      Laisser un avis
                    </button>
              )}

              {/* Owner: Share testimonial */}
              {isOwner && booking.status === 'completed' && (
                testimonialSent
                  ? <span className="flex items-center gap-1.5 px-5 py-3 text-[14px] font-semibold text-green-600 bg-white border border-green-200 rounded-[12px] shadow-sm">✓ Témoignage envoyé</span>
                  : <button
                      onClick={openTestimonialModal}
                      className="flex items-center gap-2 px-5 py-3 bg-white border border-[#c1a0fd] text-[#c1a0fd] hover:bg-[#f3ecff] text-[14px] font-semibold rounded-[12px] transition-all shadow-sm"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      Partager votre expérience
                    </button>
              )}

              {/* Kooker: info box when awaiting_confirmation */}
              {isKooker && booking.status === 'awaiting_confirmation' && (
                <div className="w-full p-4 bg-[#fef3c7] border border-[#fde68a] rounded-[12px] text-[13px] text-[#92400e] leading-relaxed">
                  <span className="font-semibold">En attente de confirmation du client.</span> La prestation sera automatiquement validée sous 48h.
                </div>
              )}

              {/* Kooker: "Noter le client" section when completed */}
              {isKooker && booking.status === 'completed' && (
                kookerHasReviewed
                  ? <span className="flex items-center gap-1.5 px-5 py-3 text-[14px] font-semibold text-green-600 bg-white border border-green-200 rounded-[12px] shadow-sm">✓ Avis laissé</span>
                  : userHasReviewed
                    ? <button
                        onClick={() => { setShowKookerReviewModal(true); setKookerReviewRating(0); setKookerReviewComment(''); }}
                        className="flex items-center gap-2 px-5 py-3 bg-[#c1a0fd] hover:bg-[#b090ed] text-white text-[14px] font-semibold rounded-[12px] transition-all shadow-sm"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                        Noter le client
                      </button>
                    : <span className="px-5 py-3 text-[13px] text-[#9ca3af]">Vous pourrez noter le client après qu'il ait laissé un avis.</span>
              )}

              {/* Cancel button (both roles, pending or confirmed) */}
              {booking.status !== 'cancelled' && booking.status !== 'completed' && booking.status !== 'awaiting_confirmation' && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="flex items-center gap-2 px-5 py-3 bg-white border border-[#fca5a5] text-[#ef4444] text-[14px] font-semibold rounded-[12px] hover:bg-[#fee2e2] transition-all shadow-sm"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  Annuler la réservation
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Testimonial Modal ── */}
      {showTestimonialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-[20px] p-6 w-full max-w-[460px] shadow-xl">
            <h2 className="text-[20px] font-semibold text-[#111125] mb-1">Partager votre expérience</h2>
            <p className="text-[14px] text-[#828294] mb-5">Votre témoignage sera affiché après validation.</p>

            {/* Stars */}
            <div className="flex gap-2 justify-center mb-5">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setTestimonialRating(star)}
                  onMouseEnter={() => setTestimonialHovered(star)}
                  onMouseLeave={() => setTestimonialHovered(0)}
                  className="text-[40px] leading-none transition-transform hover:scale-110 focus:outline-none"
                >
                  <span className={(testimonialHovered || testimonialRating) >= star ? 'text-yellow-400' : 'text-[#e0e2ef]'}>★</span>
                </button>
              ))}
            </div>

            <div className="mb-3">
              <label className="block text-[13px] font-semibold text-[#111125] mb-1.5">Nom affiché</label>
              <input
                type="text"
                value={testimonialName}
                onChange={e => setTestimonialName(e.target.value)}
                className="w-full h-[44px] rounded-[12px] border border-[#e0e2ef] px-4 text-[14px] text-[#111125] focus:outline-none focus:ring-2 focus:ring-[#c1a0fd] focus:border-transparent"
              />
            </div>

            <div className="mb-3">
              <label className="block text-[13px] font-semibold text-[#111125] mb-1.5">Votre profil <span className="font-normal text-[#9ca3af]">(facultatif)</span></label>
              <input
                type="text"
                value={testimonialRole}
                onChange={e => setTestimonialRole(e.target.value)}
                placeholder="Client depuis 2024, Amateur de cuisine…"
                className="w-full h-[44px] rounded-[12px] border border-[#e0e2ef] px-4 text-[14px] text-[#111125] focus:outline-none focus:ring-2 focus:ring-[#c1a0fd] focus:border-transparent"
              />
            </div>

            <div className="mb-5">
              <label className="block text-[13px] font-semibold text-[#111125] mb-1.5">Votre témoignage</label>
              <textarea
                value={testimonialContent}
                onChange={e => setTestimonialContent(e.target.value)}
                placeholder="Décrivez votre expérience Weekook…"
                rows={3}
                className="w-full rounded-[12px] border border-[#e0e2ef] px-4 py-3 text-[14px] text-[#111125] placeholder-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#c1a0fd] focus:border-transparent resize-none"
              />
              {testimonialContent.trim().length > 0 && testimonialContent.trim().length < 10 && (
                <p className="text-[12px] text-red-400 mt-1">Minimum 10 caractères.</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowTestimonialModal(false)}
                className="flex-1 h-[48px] rounded-[12px] border border-[#e0e2ef] text-[14px] font-medium text-[#6b7280] hover:border-[#c1a0fd] transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmitTestimonial}
                disabled={testimonialContent.trim().length < 10 || !testimonialName.trim() || testimonialSubmitting}
                className="flex-1 h-[48px] rounded-[12px] bg-[#c1a0fd] hover:bg-[#b090ed] text-white text-[14px] font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {testimonialSubmitting
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Envoi...</>
                  : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Review Modal ── */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-[20px] p-6 w-full max-w-[420px] shadow-xl">
            <h2 className="text-[20px] font-semibold text-[#111125] mb-1">Laisser un avis</h2>
            <p className="text-[14px] text-[#828294] mb-5">pour {kookerUser.firstName} {kookerUser.lastName}</p>

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
                onClick={() => setShowReviewModal(false)}
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

      {/* ── Accept Modal ── */}
      {showAcceptModal && booking && (
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
                <span className="font-semibold text-[#111125]">{clientUser.firstName} {clientUser.lastName}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[#6b7280]">Prestation</span>
                <span className="font-semibold text-[#111125] text-right max-w-[60%]">{booking.service.title}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[#6b7280]">Date</span>
                <span className="font-semibold text-[#111125]">
                  {new Date(booking.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {String(booking.startTime).slice(0, 5)}
                </span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[#6b7280]">{isKours ? 'Participants' : 'Convives'}</span>
                <span className="font-semibold text-[#111125]">{booking.guests} personne{booking.guests > 1 ? 's' : ''}</span>
              </div>
              <div className="h-px bg-[#e0e2ef] my-1" />
              <div className="flex justify-between text-[14px]">
                <span className="font-semibold text-[#111125]">Montant</span>
                <span className="font-bold text-[#c1a0fd]">{formatPrice(booking.totalPriceInCents)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAcceptModal(false)}
                disabled={actionLoading}
                className="flex-1 h-[48px] rounded-[12px] border border-[#e0e2ef] text-[14px] font-medium text-[#6b7280] hover:border-[#c1a0fd] hover:text-[#111125] transition-all disabled:opacity-40"
              >
                Annuler
              </button>
              <button
                onClick={handleAcceptBooking}
                disabled={actionLoading}
                className="flex-1 h-[48px] rounded-[12px] bg-[#c1a0fd] hover:bg-[#b090ed] text-white text-[14px] font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {actionLoading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Confirmation...</>
                  : "Confirmer l'acceptation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Refuse Modal ── */}
      {showRefuseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-[20px] p-6 w-full max-w-[480px] shadow-xl max-h-[90vh] overflow-y-auto">
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
                onClick={() => { setShowRefuseModal(false); setRefusalReasonId('unavailable'); setRefusalCustom(''); }}
                disabled={actionLoading}
                className="flex-1 h-[48px] rounded-[12px] border border-[#e5e7eb] text-[14px] font-medium text-[#6b7280] hover:border-[#c1a0fd] hover:text-[#111125] transition-all disabled:opacity-40"
              >
                Annuler
              </button>
              <button
                onClick={handleRefuseBooking}
                disabled={(refusalReasonId === 'custom' && !refusalCustom.trim()) || actionLoading}
                className="flex-1 h-[48px] rounded-[12px] bg-red-500 text-white text-[14px] font-semibold hover:bg-red-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {actionLoading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Refus...</>
                  : 'Confirmer le refus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Complete Modal ── */}
      {showCompleteModal && booking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111125]/30 backdrop-blur-sm px-4">
          <div className="bg-white rounded-[20px] p-8 w-full max-w-[440px] shadow-xl border border-[#e0e2ef]">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#dcfce7] mx-auto mb-5">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h3 className="text-[18px] font-bold text-[#111125] text-center mb-1">Marquer comme terminée ?</h3>
            <p className="text-[13px] text-[#6b7280] text-center mb-6">
              La prestation "{booking.service.title}" pour {clientUser.firstName} {clientUser.lastName} sera marquée comme terminée. Le client pourra ensuite laisser un avis.
            </p>

            <div className="bg-[#f2f4fc] rounded-[14px] px-5 py-4 mb-7 space-y-2">
              <div className="flex justify-between text-[13px]">
                <span className="text-[#6b7280]">Prestation</span>
                <span className="font-semibold text-[#111125] text-right max-w-[60%]">{booking.service.title}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[#6b7280]">Date</span>
                <span className="font-semibold text-[#111125]">{formatDateLong(booking.date)}</span>
              </div>
              <div className="h-px bg-[#e0e2ef] my-1" />
              <div className="flex justify-between text-[14px]">
                <span className="font-semibold text-[#111125]">Montant</span>
                <span className="font-bold text-[#c1a0fd]">{formatPrice(booking.totalPriceInCents)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCompleteModal(false)}
                disabled={actionLoading}
                className="flex-1 h-[48px] rounded-[12px] border border-[#e0e2ef] text-[14px] font-medium text-[#6b7280] hover:border-[#c1a0fd] hover:text-[#111125] transition-all disabled:opacity-40"
              >
                Annuler
              </button>
              <button
                onClick={handleCompleteBooking}
                disabled={actionLoading}
                className="flex-1 h-[48px] rounded-[12px] bg-[#16a34a] hover:bg-[#15803d] text-white text-[14px] font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {actionLoading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Mise à jour...</>
                  : 'Confirmer la fin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Modal ── */}
      {showCancelModal && booking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111125]/30 backdrop-blur-sm px-4">
          <div className="bg-white rounded-[20px] p-8 w-full max-w-[440px] shadow-xl border border-[#e0e2ef]">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#fee2e2] mx-auto mb-5">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <h3 className="text-[18px] font-bold text-[#111125] text-center mb-1">Annuler cette réservation ?</h3>
            <p className="text-[13px] text-[#6b7280] text-center mb-6">
              Cette action est irréversible. {isOwner ? 'Le kooker' : 'Le client'} sera notifié par message et par e-mail.
            </p>

            <div className="bg-[#f2f4fc] rounded-[14px] px-5 py-4 mb-7 space-y-2">
              <div className="flex justify-between text-[13px]">
                <span className="text-[#6b7280]">Prestation</span>
                <span className="font-semibold text-[#111125] text-right max-w-[60%]">{booking.service.title}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[#6b7280]">Date</span>
                <span className="font-semibold text-[#111125]">{formatDateLong(booking.date)}</span>
              </div>
              <div className="h-px bg-[#e0e2ef] my-1" />
              <div className="flex justify-between text-[14px]">
                <span className="font-semibold text-[#111125]">Montant</span>
                <span className="font-bold text-[#c1a0fd]">{formatPrice(booking.totalPriceInCents)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={actionLoading}
                className="flex-1 h-[48px] rounded-[12px] border border-[#e0e2ef] text-[14px] font-medium text-[#6b7280] hover:border-[#c1a0fd] hover:text-[#111125] transition-all disabled:opacity-40"
              >
                Ne pas annuler
              </button>
              <button
                onClick={handleCancelBooking}
                disabled={actionLoading}
                className="flex-1 h-[48px] rounded-[12px] bg-red-500 text-white text-[14px] font-semibold hover:bg-red-600 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {actionLoading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Annulation...</>
                  : 'Confirmer l\'annulation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Kooker Review Modal (kooker_to_user) ── */}
      {showKookerReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-[20px] p-6 w-full max-w-[420px] shadow-xl">
            <h2 className="text-[20px] font-semibold text-[#111125] mb-1">Noter le client</h2>
            <p className="text-[14px] text-[#828294] mb-5">pour {clientUser.firstName} {clientUser.lastName}</p>

            {/* Stars */}
            <div className="flex gap-2 justify-center mb-5">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setKookerReviewRating(star)}
                  onMouseEnter={() => setKookerReviewHovered(star)}
                  onMouseLeave={() => setKookerReviewHovered(0)}
                  className="text-[40px] leading-none transition-transform hover:scale-110 focus:outline-none"
                >
                  <span className={(kookerReviewHovered || kookerReviewRating) >= star ? 'text-yellow-400' : 'text-[#e0e2ef]'}>★</span>
                </button>
              ))}
            </div>
            {kookerReviewRating > 0 && (
              <p className="text-center text-[13px] text-[#828294] mb-4">
                {['', 'Décevant', 'Peut mieux faire', 'Bien', 'Très bien', 'Excellent !'][kookerReviewRating]}
              </p>
            )}

            {/* Comment */}
            <textarea
              value={kookerReviewComment}
              onChange={e => setKookerReviewComment(e.target.value)}
              placeholder="Partagez votre expérience avec ce client (facultatif)..."
              rows={3}
              className="w-full rounded-[12px] border border-[#e0e2ef] px-4 py-3 text-[14px] text-[#111125] placeholder-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#c1a0fd] focus:border-transparent resize-none mb-5"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowKookerReviewModal(false)}
                className="flex-1 h-[48px] rounded-[12px] border border-[#e0e2ef] text-[14px] font-medium text-[#6b7280] hover:border-[#c1a0fd] transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmitKookerReview}
                disabled={kookerReviewRating === 0 || kookerReviewSubmitting}
                className="flex-1 h-[48px] rounded-[12px] bg-[#c1a0fd] hover:bg-[#b090ed] text-white text-[14px] font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {kookerReviewSubmitting
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Envoi...</>
                  : 'Publier l\'avis'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
