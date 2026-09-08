import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Elements } from '@stripe/react-stripe-js';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getStripe } from '@/lib/stripe';
import { StripePaymentForm, StripePaymentFormHandle } from '@/components/payment/StripePaymentForm';
import type { Stripe } from '@stripe/stripe-js';
import { usePageTiming } from '@/hooks/usePageTiming';

// ─── Types ──────────────────────────────────────────────────────────────────────
interface ServiceDetail {
  id: number;
  title: string;
  description: string;
  priceInCents: number;
  extraGuestPriceInCents: number | null;
  durationMinutes: number;
  minGuests: number;
  maxGuests: number;
  type: string;
  specialties: string[];
  koursDifficulty?: string | null;
  koursLocation?: string | null;
  equipmentProvided?: boolean;
  ingredientsList?: { name: string; quantity: string; unit: string }[] | null;
  ingredientsBaseServings?: number | null;
}

interface Availability {
  date: string;      // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  isAvailable: boolean;
}

interface CreatedBooking {
  id: number;
  date: string;
  startTime: string;
  guests: number;
  totalPriceInCents: number;
  status: string;
  service: {
    title: string;
  };
  kookerProfile: {
    user: {
      firstName: string;
      lastName: string;
    };
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────────
function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (Array.isArray(value)) return value as unknown as T;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

function formatDateFr(dateStr: string): string {
  const datePart = dateStr.includes('T') ? dateStr.substring(0, 10) : dateStr;
  const date = new Date(datePart + 'T00:00:00');
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// ─── Component ──────────────────────────────────────────────────────────────────
export default function BookingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const serviceId = searchParams.get('service');
  const kookerId = searchParams.get('kooker');

  // Data state
  const [service, setService] = useState<ServiceDetail | null>(null);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [confirmedSlotsMap, setConfirmedSlotsMap] = useState<Map<string, Set<string>>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  usePageTiming('Réservation', !isLoading);
  const [loadError, setLoadError] = useState(false);

  // Selection state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [guests, setGuests] = useState(1);
  const [notes, setNotes] = useState('');
  const [ingredientsSource, setIngredientsSource] = useState<'client' | 'kooker'>('client');
  const [ingredientsChoiceEnabled, setIngredientsChoiceEnabled] = useState(true);

  // Payment phase state
  const [showPayment, setShowPayment] = useState(false);
  const [stripeInstance, setStripeInstance] = useState<Stripe | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const paymentFormRef = useRef<StripePaymentFormHandle>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdBooking, setCreatedBooking] = useState<CreatedBooking | null>(null);

  // Calendar state
  const now = new Date();
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth());

  // ─── Load public config ──────────────────────────────────────────────────
  useEffect(() => {
    api.get<{ ingredientsChoiceEnabled?: boolean; ingredientsChoiceDefault?: string }>('/admin/config/public')
      .then(res => {
        if (res.success && res.data) {
          if (typeof res.data.ingredientsChoiceEnabled === 'boolean') setIngredientsChoiceEnabled(res.data.ingredientsChoiceEnabled);
          if (res.data.ingredientsChoiceDefault === 'kooker' || res.data.ingredientsChoiceDefault === 'client') {
            setIngredientsSource(res.data.ingredientsChoiceDefault);
          }
        }
      }).catch(() => {});
  }, []);

  // ─── Load service + availability ────────────────────────────────────────────
  useEffect(() => {
    if (!serviceId || !kookerId) {
      setLoadError(true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(false);

    Promise.all([
      api.get<any>(`/services/${serviceId}`),
      api.get<Availability[]>(`/availability/kooker/${kookerId}`),
      api.get<any>(`/kookers/${kookerId}`),
    ])
      .then(([serviceRes, availRes, kookerRes]) => {
        if (serviceRes.success && serviceRes.data) {
          const s = serviceRes.data;
          const min = s.minGuests ?? 1;
          setService({
            id: s.id,
            title: s.title || '',
            description: s.description || '',
            priceInCents: s.priceInCents || 0,
            extraGuestPriceInCents: s.extraGuestPriceInCents ?? null,
            durationMinutes: s.durationMinutes || 0,
            minGuests: min,
            maxGuests: s.maxGuests || 1,
            type: safeJsonParse<string[]>(s.type, []).join(', '),
            specialties: safeJsonParse<string[]>(s.specialties, []),
            koursDifficulty: s.koursDifficulty || null,
            koursLocation: s.koursLocation || null,
            equipmentProvided: s.equipmentProvided || false,
            ingredientsList: safeJsonParse<{ name: string; quantity: string; unit: string }[]>(s.ingredientsList, []),
            ingredientsBaseServings: s.ingredientsBaseServings ?? null,
          });
          setGuests(min);
        } else {
          setLoadError(true);
        }

        if (availRes.success && availRes.data) {
          setAvailabilities(
            (availRes.data as Availability[]).filter((a) => a.isAvailable)
          );
        }

        if (kookerRes.success && kookerRes.data?.confirmedSlots) {
          const map = new Map<string, Set<string>>();
          for (const s of kookerRes.data.confirmedSlots as { date: string; startTime: string }[]) {
            const d = String(s.date).slice(0, 10);
            const t = String(s.startTime).slice(0, 5);
            if (!map.has(d)) map.set(d, new Set());
            map.get(d)!.add(t);
          }
          setConfirmedSlotsMap(map);
        }
      })
      .catch(() => {
        setLoadError(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [serviceId, kookerId]);

  // ─── Available dates map (excludes dates where ALL slots are confirmed) ────
  const availableDatesMap = useMemo(() => {
    const map = new Map<string, Availability[]>();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    for (const av of availabilities) {
      const dateKey = av.date.substring(0, 10);
      if (dateKey < todayStr) continue;
      const existing = map.get(dateKey) || [];
      existing.push(av);
      map.set(dateKey, existing);
    }
    for (const [date, slots] of map) {
      const booked = confirmedSlotsMap.get(date);
      if (booked && slots.every(s => booked.has(String(s.startTime).slice(0, 5)))) {
        map.delete(date);
      }
    }
    return map;
  }, [availabilities, confirmedSlotsMap]);

  // ─── Time slots for selected date ───────────────────────────────────────────
  const timeSlotsForDate = useMemo(() => {
    if (!selectedDate) return [];
    return availableDatesMap.get(selectedDate) || [];
  }, [selectedDate, availableDatesMap]);

  // ─── Reset downstream selections when parent changes ────────────────────────
  useEffect(() => {
    setSelectedTime(null);
  }, [selectedDate]);

  // ─── Calendar navigation ───────────────────────────────────────────────────
  const goToPrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  };

  // ─── Calendar rendering data ──────────────────────────────────────────────
  const daysInMonth = getDaysInMonth(calendarYear, calendarMonth);
  const firstDay = getFirstDayOfMonth(calendarYear, calendarMonth);
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // ─── Handle "Réserver" click → show payment step or direct booking ──────
  const handleReserveClick = async () => {
    // Try to load Stripe
    setStripeLoading(true);
    const s = await getStripe();
    setStripeLoading(false);

    if (s) {
      // Stripe available → show payment form
      setStripeInstance(s);
      setShowPayment(true);
    } else {
      // Stripe not configured → create booking directly (no payment)
      await handleDirectBooking();
    }
  };

  // ─── Direct booking (when Stripe is not configured) ───────────────────
  const handleDirectBooking = async () => {
    if (!selectedDate || !selectedTime || !service) return;

    setIsSubmitting(true);
    try {
      const res = await api.post<{ booking: CreatedBooking; clientSecret?: string }>('/bookings', {
        serviceId: service.id,
        date: selectedDate,
        startTime: selectedTime,
        guests,
        notes: notes.trim() || undefined,
        ingredientsSource: scaledIngredients.length > 0 ? ingredientsSource : undefined,
      });

      if (!res.success || !res.data) {
        toast.error(res.error || 'Une erreur est survenue.');
        return;
      }

      setCreatedBooking(res.data.booking);
      toast.success('Réservation confirmée !');
    } catch (err: any) {
      toast.error(err?.error || 'Une erreur est survenue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Handle payment submit ────────────────────────────────────────────────
  const handlePaymentSubmit = async () => {
    if (!selectedDate || !selectedTime || !service) return;

    setIsSubmitting(true);
    try {
      // Step 1: Create booking + PaymentIntent
      const res = await api.post<{ booking: CreatedBooking; clientSecret: string }>('/bookings', {
        serviceId: service.id,
        date: selectedDate,
        startTime: selectedTime,
        guests,
        notes: notes.trim() || undefined,
        ingredientsSource: scaledIngredients.length > 0 ? ingredientsSource : undefined,
      });

      if (!res.success || !res.data) {
        toast.error(res.error || 'Une erreur est survenue.');
        return;
      }

      const { booking, clientSecret } = res.data;

      // Step 2: Confirm payment with Stripe (pre-authorization)
      const paymentResult = await paymentFormRef.current?.confirmPayment(clientSecret);

      if (!paymentResult?.success) {
        toast.error(paymentResult?.error || 'Le paiement a échoué.');
        try { await api.put(`/bookings/${booking.id}/cancel`, {}); } catch { /* ignore */ }
        return;
      }

      // Step 3: Confirm payment on server
      await api.post(`/bookings/${booking.id}/confirm-payment`, {});

      setCreatedBooking(booking);
      toast.success('Réservation confirmée !');
    } catch (err: any) {
      toast.error(err?.error || 'Une erreur est survenue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Derived values ────────────────────────────────────────────────────────
  const isKours = service ? service.type.includes('COURS') : false;
  const guestLabel = isKours ? 'participant' : 'convive';
  const guestLabelPlural = isKours ? 'participants' : 'convives';
  const totalPriceCents = service
    ? isKours
      ? service.priceInCents + Math.max(0, guests - 6) * (service.extraGuestPriceInCents ?? 0)
      : service.priceInCents * guests
    : 0;
  const guestsError = service
    ? guests < service.minGuests
      ? `Minimum ${service.minGuests} ${guests < service.minGuests ? guestLabelPlural : guestLabel} requis pour ce service.`
      : guests > service.maxGuests
        ? `Maximum ${service.maxGuests} ${guestLabelPlural} pour ce service.`
        : null
    : null;
  const canConfirm = !!selectedDate && !!selectedTime && !guestsError && !!service;

  // ─── Ingrédients mis à l'échelle selon le nombre de convives ─────────────
  const scaledIngredients = useMemo(() => {
    const list = service?.ingredientsList;
    const base = service?.ingredientsBaseServings;
    if (!list?.length) return [];
    if (!base || base <= 0) return list;
    const ratio = guests / base;
    return list.map((ing) => {
      const qty = parseFloat(ing.quantity);
      if (isNaN(qty)) return ing;
      const scaled = qty * ratio;
      const formatted = Number.isInteger(scaled) ? String(scaled) : parseFloat(scaled.toFixed(2)).toString();
      return { ...ing, quantity: formatted };
    });
  }, [service, guests]);

  // ─── Error state ──────────────────────────────────────────────────────────
  if (!isLoading && loadError) {
    return (
      <div className="min-h-screen bg-[#f2f4fc] flex flex-col items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-[48px] font-bold text-[#c1a0fd]">Oups</h1>
          <p className="mt-2 text-[18px] font-semibold text-[#111125]">
            Service introuvable
          </p>
          <p className="mt-1 text-[15px] text-[#6b7280]">
            Ce service n'existe pas ou les parametres sont invalides.
          </p>
          <button
            onClick={() => navigate('/recherche')}
            className="mt-6 px-6 py-2.5 bg-[#c1a0fd] text-white font-semibold rounded-[12px] hover:bg-[#b090ed] transition-all"
          >
            Rechercher un kooker
          </button>
        </div>
      </div>
    );
  }

  // ─── Loading state ────────────────────────────────────────────────────────
  if (isLoading || !service) {
    return (
      <div className="min-h-screen bg-[#f2f4fc] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#c1a0fd] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#5c5c6f] font-medium">Chargement...</p>
        </div>
      </div>
    );
  }

  // ─── Success state ────────────────────────────────────────────────────────
  if (createdBooking) {
    return (
      <div className="min-h-screen bg-[#f2f4fc] py-10 md:py-16">
        <div className="px-4 md:px-8 lg:px-[96px] max-w-[640px] mx-auto">
          <div className="bg-white rounded-[20px] shadow-sm border border-[#e5e7eb]/50 p-6 md:p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-[#dcfce7] flex items-center justify-center">
              <svg className="w-8 h-8 text-[#16a34a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 className="text-[24px] md:text-[28px] font-bold text-[#111125]">
              Reservation confirmee !
            </h1>
            <p className="mt-2 text-[15px] text-[#6b7280]">
              Votre demande de reservation a bien ete envoyee.
            </p>

            <div className="mt-6 bg-[#f2f4fc] rounded-[16px] p-5 text-left space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[14px] text-[#6b7280]">Service</span>
                <span className="text-[14px] font-semibold text-[#111125]">
                  {createdBooking.service?.title || service.title}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[14px] text-[#6b7280]">Date</span>
                <span className="text-[14px] font-semibold text-[#111125]">
                  {formatDateFr(createdBooking.date)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[14px] text-[#6b7280]">Heure</span>
                <span className="text-[14px] font-semibold text-[#111125]">
                  {createdBooking.startTime}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[14px] text-[#6b7280]">{isKours ? 'Participants' : 'Convives'}</span>
                <span className="text-[14px] font-semibold text-[#111125]">
                  {createdBooking.guests} personne{createdBooking.guests > 1 ? 's' : ''}
                </span>
              </div>
              <div className="border-t border-[#e5e7eb] pt-3 flex justify-between items-center">
                <span className="text-[15px] font-semibold text-[#111125]">Total</span>
                <span className="text-[18px] font-bold text-[#c1a0fd]">
                  {formatPrice(createdBooking.totalPriceInCents)}&euro;
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate('/tableau-de-bord')}
                className="px-6 py-3 bg-[#c1a0fd] text-white font-semibold rounded-[12px] hover:bg-[#b090ed] transition-all text-[15px]"
              >
                Voir mes reservations
              </button>
              <button
                onClick={() => navigate(`/kooker/${kookerId}`)}
                className="px-6 py-3 bg-white border border-[#e5e7eb] text-[#111125] font-medium rounded-[12px] hover:border-[#c1a0fd] hover:text-[#c1a0fd] transition-all text-[15px]"
              >
                Retour au profil
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Payment phase (shown after clicking "Réserver") ────────────────────
  if (showPayment) {
    return (
      <div className="min-h-screen bg-[#f2f4fc] py-8 md:py-12">
        <div className="px-4 md:px-8 lg:px-[96px] max-w-[640px] mx-auto">
          {/* Back to booking form */}
          <button
            onClick={() => setShowPayment(false)}
            disabled={isSubmitting}
            className="flex items-center gap-2 mb-6 text-[14px] font-medium text-[#6b7280] hover:text-[#111125] transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Modifier la réservation
          </button>

          <h1 className="text-[24px] md:text-[32px] font-bold text-[#111125] mb-6">
            Finaliser le paiement
          </h1>

          {/* Booking summary */}
          <section className="bg-white rounded-[20px] shadow-sm border border-[#e5e7eb]/50 p-5 md:p-6 mb-6">
            <h2 className="text-[16px] font-semibold text-[#111125] mb-4">Récapitulatif</h2>
            <div className="bg-[#f2f4fc] rounded-[16px] p-4 md:p-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[14px] text-[#6b7280]">Service</span>
                <span className="text-[14px] font-semibold text-[#111125]">{service.title}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[14px] text-[#6b7280]">Date</span>
                <span className="text-[14px] font-semibold text-[#111125]">{formatDateFr(selectedDate!)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[14px] text-[#6b7280]">Créneau</span>
                <span className="text-[14px] font-semibold text-[#111125]">{selectedTime}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[14px] text-[#6b7280]">{isKours ? 'Participants' : 'Convives'}</span>
                <span className="text-[14px] font-semibold text-[#111125]">{guests} personne{guests > 1 ? 's' : ''}</span>
              </div>
              <div className="border-t border-[#e5e7eb] pt-3 flex justify-between items-center">
                <span className="text-[16px] font-bold text-[#111125]">Total</span>
                <span className="text-[22px] font-bold text-[#c1a0fd]">{formatPrice(totalPriceCents)}&euro;</span>
              </div>
            </div>
          </section>

          {/* Payment form */}
          <section className="bg-white rounded-[20px] shadow-sm border border-[#e5e7eb]/50 p-5 md:p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-[#c1a0fd] flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
              </div>
              <h2 className="text-[18px] font-semibold text-[#111125]">
                Informations de paiement
              </h2>
            </div>

            <p className="text-[13px] text-[#6b7280] mb-4">
              Votre carte sera pré-autorisée. Le montant ne sera débité que lorsque le kooker acceptera votre réservation.
            </p>

            {stripeLoading || !stripeInstance ? (
              <div className="flex items-center gap-2 text-[13px] text-[#9ca3af] py-4">
                <div className="w-4 h-4 border-2 border-[#c1a0fd] border-t-transparent rounded-full animate-spin" />
                Chargement du module de paiement...
              </div>
            ) : (
              <Elements stripe={stripeInstance}>
                <StripePaymentForm ref={paymentFormRef} />
              </Elements>
            )}

            <div className="mt-3 flex items-center gap-2 text-[12px] text-[#9ca3af]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Paiement sécurisé par Stripe
            </div>
          </section>

          {/* Pay button */}
          <button
            onClick={handlePaymentSubmit}
            disabled={isSubmitting || !stripeInstance}
            className="w-full py-3.5 bg-[#c1a0fd] text-white font-semibold rounded-[12px] hover:bg-[#b090ed] transition-all text-[16px] shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Paiement en cours...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Payer et confirmer — {formatPrice(totalPriceCents)}&euro;
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ─── Main booking form ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f2f4fc] py-8 md:py-12">
      <div className="px-4 md:px-8 lg:px-[96px] max-w-[780px] mx-auto">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 mb-6 text-[14px] font-medium text-[#6b7280] hover:text-[#111125] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Retour
        </button>

        <h1 className="text-[24px] md:text-[32px] font-bold text-[#111125] mb-8">
          Reserver
        </h1>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* STEP 1 - Service Summary                                       */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-[20px] shadow-sm border border-[#e5e7eb]/50 p-5 md:p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#c1a0fd] flex items-center justify-center text-white font-bold text-[14px]">
              1
            </div>
            <h2 className="text-[18px] font-semibold text-[#111125]">
              Service selectionne
            </h2>
          </div>

          <div className="bg-[#f2f4fc] rounded-[16px] p-4 md:p-5">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-[16px] md:text-[18px] font-semibold text-[#111125]">
                  {service.title}
                </h3>
                {service.type && (
                  <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide bg-[#ede7fb] text-[#7c5cbf]">
                    {service.type}
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-[20px] font-bold text-[#c1a0fd]">
                  {formatPrice(service.priceInCents)}&euro;
                </span>
                <span className="text-[13px] text-[#6b7280] ml-1">
                  {isKours ? '/ 1-6 élèves' : '/pers.'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-3 text-[13px] text-[#6b7280]">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatDuration(service.durationMinutes)}
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {service.maxGuests} personne{service.maxGuests > 1 ? 's' : ''} max
              </span>
            </div>

            {service.description && (
              <p className="mt-3 text-[14px] text-[#4b5563] leading-relaxed">
                {service.description}
              </p>
            )}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* STEP 2 - Select Date                                           */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-[20px] shadow-sm border border-[#e5e7eb]/50 p-5 md:p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#c1a0fd] flex items-center justify-center text-white font-bold text-[14px]">
              2
            </div>
            <h2 className="text-[18px] font-semibold text-[#111125]">
              Choisir une date
            </h2>
          </div>

          {availableDatesMap.size === 0 ? (
            <div className="py-8 text-center">
              <p className="text-[15px] text-[#6b7280]">
                Aucune disponibilite future pour ce kooker.
              </p>
            </div>
          ) : (
            <div className="max-w-[420px]">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={goToPrevMonth}
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#f3f4f6] transition-colors"
                >
                  <svg className="w-5 h-5 text-[#6b7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h3 className="text-[15px] font-semibold text-[#111125]">
                  {MONTH_NAMES[calendarMonth]} {calendarYear}
                </h3>
                <button
                  onClick={goToNextMonth}
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#f3f4f6] transition-colors"
                >
                  <svg className="w-5 h-5 text-[#6b7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-7 mb-2">
                {DAY_NAMES.map((day) => (
                  <div
                    key={day}
                    className="text-center text-[12px] font-medium text-[#9ca3af] py-1"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {calendarDays.map((day, idx) => {
                  if (day === null) {
                    return <div key={`empty-${idx}`} className="h-10" />;
                  }

                  const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isToday = dateStr === todayStr;
                  const isAvailable = availableDatesMap.has(dateStr);
                  const isPast = dateStr < todayStr;
                  const isSelected = dateStr === selectedDate;

                  return (
                    <div
                      key={dateStr}
                      className="relative flex items-center justify-center h-10"
                    >
                      <button
                        disabled={!isAvailable}
                        onClick={() => isAvailable ? setSelectedDate(dateStr) : undefined}
                        className={`w-8 h-8 flex items-center justify-center rounded-full text-[13px] transition-colors ${
                          isSelected
                            ? 'bg-[#111125] text-white font-bold ring-2 ring-[#c1a0fd]'
                            : isAvailable
                              ? 'bg-green-500 text-white font-semibold cursor-pointer hover:bg-green-600'
                              : isToday
                                ? 'bg-[#f3f4f6] text-[#111125] font-semibold ring-2 ring-[#c1a0fd]'
                                : isPast
                                  ? 'text-[#d1d5db] cursor-default'
                                  : 'text-[#6b7280] cursor-default'
                        }`}
                      >
                        {day}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[#f0f0f0]">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-[12px] text-[#6b7280]">Disponible</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#111125] ring-2 ring-[#c1a0fd]" />
                  <span className="text-[12px] text-[#6b7280]">Selectionne</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* STEP 3 - Select Time Slot                                      */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section className={`bg-white rounded-[20px] shadow-sm border border-[#e5e7eb]/50 p-5 md:p-6 mb-6 transition-opacity ${selectedDate ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[14px] ${selectedDate ? 'bg-[#c1a0fd] text-white' : 'bg-[#e5e7eb] text-[#9ca3af]'}`}>
              3
            </div>
            <h2 className="text-[18px] font-semibold text-[#111125]">
              Choisir un creneau
            </h2>
          </div>

          {selectedDate && timeSlotsForDate.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {timeSlotsForDate.map((slot, idx) => {
                const isSelected = selectedTime === slot.startTime;
                const slotTime = String(slot.startTime).slice(0, 5);
                const isConfirmed = confirmedSlotsMap.get(selectedDate)?.has(slotTime);
                return (
                  <button
                    key={idx}
                    disabled={!!isConfirmed}
                    onClick={() => !isConfirmed && setSelectedTime(slot.startTime)}
                    className={`px-5 py-3 rounded-[12px] text-[14px] font-medium transition-all border ${
                      isConfirmed
                        ? 'bg-[#f9fafb] text-[#9ca3af] border-[#e5e7eb] cursor-not-allowed line-through'
                        : isSelected
                          ? 'bg-[#c1a0fd] text-white border-[#c1a0fd] shadow-sm'
                          : 'bg-white text-[#111125] border-[#e5e7eb] hover:border-[#c1a0fd] hover:text-[#c1a0fd]'
                    }`}
                  >
                    {slot.startTime} - {slot.endTime}
                    {isConfirmed && <span className="ml-2 text-[11px] font-normal no-underline" style={{ textDecoration: 'none' }}>Complet</span>}
                  </button>
                );
              })}
            </div>
          ) : selectedDate ? (
            <p className="text-[14px] text-[#6b7280]">
              Aucun creneau disponible pour cette date.
            </p>
          ) : (
            <p className="text-[14px] text-[#9ca3af]">
              Selectionnez d'abord une date.
            </p>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* STEP 4 - Guests & Notes                                        */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section className={`bg-white rounded-[20px] shadow-sm border border-[#e5e7eb]/50 p-5 md:p-6 mb-6 transition-opacity ${selectedTime ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[14px] ${selectedTime ? 'bg-[#c1a0fd] text-white' : 'bg-[#e5e7eb] text-[#9ca3af]'}`}>
              4
            </div>
            <h2 className="text-[18px] font-semibold text-[#111125]">
              {isKours ? 'Participants et notes' : 'Convives et notes'}
            </h2>
          </div>

          <div className="space-y-5">
            <div>
              <label htmlFor="guests" className="block text-[14px] font-medium text-[#111125] mb-1.5">
                {isKours ? 'Nombre de participants' : 'Nombre de convives'}
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setGuests((g) => Math.max(1, g - 1))}
                  disabled={guests <= 1}
                  className="w-10 h-10 flex items-center justify-center rounded-[12px] border border-[#e5e7eb] text-[#111125] hover:border-[#c1a0fd] hover:text-[#c1a0fd] transition-all disabled:opacity-40 disabled:cursor-default disabled:hover:border-[#e5e7eb] disabled:hover:text-[#111125]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <input
                  id="guests"
                  type="number"
                  min={1}
                  max={service.maxGuests}
                  value={guests}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v >= 1) setGuests(v);
                  }}
                  className={`w-16 h-10 text-center rounded-[12px] border text-[16px] font-semibold text-[#111125] focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                    guestsError
                      ? 'border-[#ef4444] focus:ring-[#ef4444]'
                      : 'border-[#e5e7eb] focus:ring-[#c1a0fd]'
                  }`}
                />
                <button
                  onClick={() => setGuests((g) => Math.min(service.maxGuests, g + 1))}
                  disabled={guests >= service.maxGuests}
                  className="w-10 h-10 flex items-center justify-center rounded-[12px] border border-[#e5e7eb] text-[#111125] hover:border-[#c1a0fd] hover:text-[#c1a0fd] transition-all disabled:opacity-40 disabled:cursor-default disabled:hover:border-[#e5e7eb] disabled:hover:text-[#111125]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <span className="text-[13px] text-[#6b7280]">
                  {service.minGuests > 1 ? `${service.minGuests} min` : ''}{service.minGuests > 1 && ' · '}{service.maxGuests} max
                </span>
              </div>
              {guestsError && (
                <p className="mt-2 text-[13px] text-[#ef4444] flex items-center gap-1.5">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  {guestsError}
                </p>
              )}
            </div>

            {/* ─── Ingrédients : toggle client / kooker ───────────── */}
            {scaledIngredients.length > 0 && (
              <div className="rounded-[16px] border border-[#e5e7eb] overflow-hidden">
                {/* Toggle — visible seulement si activé en admin */}
                {ingredientsChoiceEnabled && (
                  <div className="flex gap-1.5 p-1.5 bg-[#f2f4fc]">
                    {(['client', 'kooker'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setIngredientsSource(opt)}
                        className={`flex-1 flex items-center justify-center gap-2 h-[38px] rounded-[10px] text-[13px] font-semibold transition-all cursor-pointer ${
                          ingredientsSource === opt
                            ? 'bg-white text-[#c1a0fd] shadow-sm'
                            : 'text-[#828294] hover:text-[#303044]'
                        }`}
                      >
                        {opt === 'client' ? '🛒 J\'achète les ingrédients' : '👨‍🍳 Le kooker fournit'}
                      </button>
                    ))}
                  </div>
                )}

                {/* Contenu selon le choix */}
                <div className="p-4">
                  {ingredientsSource === 'client' ? (
                    <>
                      <p className="text-[13px] font-semibold text-[#111125] mb-1">
                        Liste d'ingrédients à acheter
                      </p>
                      <p className="text-[12px] text-[#828294] mb-3">
                        Pour {guests} {guests > 1 ? guestLabelPlural : guestLabel} — calculé automatiquement
                      </p>
                      <div className="space-y-1.5">
                        {scaledIngredients.map((ing, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-3 bg-[#f8f9fc] rounded-[10px] px-3 py-2">
                            <span className="text-[13px] text-[#303044] font-medium truncate">{ing.name}</span>
                            <span className="text-[13px] text-[#c1a0fd] font-semibold shrink-0">{ing.quantity} {ing.unit}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-start gap-3">
                      <span className="text-[24px] leading-none mt-0.5">👨‍🍳</span>
                      <div>
                        <p className="text-[13px] font-semibold text-[#111125] mb-1">Le kooker se charge des courses</p>
                        <p className="text-[12px] text-[#828294]">
                          Cette préférence sera transmise au kooker avec votre réservation. Un supplément peut être appliqué selon les ingrédients choisis.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="notes" className="block text-[14px] font-medium text-[#111125] mb-1.5">
                Notes <span className="text-[#9ca3af] font-normal">(optionnel)</span>
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Allergies, preferences, informations utiles..."
                rows={3}
                className="w-full rounded-[12px] border border-[#e5e7eb] px-4 py-3 text-[14px] text-[#111125] placeholder-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#c1a0fd] focus:border-transparent resize-none"
              />
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* STEP 5 - Summary & Reserve button                              */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section className={`bg-white rounded-[20px] shadow-sm border border-[#e5e7eb]/50 p-5 md:p-6 mb-6 transition-opacity ${canConfirm ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[14px] ${canConfirm ? 'bg-[#c1a0fd] text-white' : 'bg-[#e5e7eb] text-[#9ca3af]'}`}>
              5
            </div>
            <h2 className="text-[18px] font-semibold text-[#111125]">
              Recapitulatif
            </h2>
          </div>

          {canConfirm && (
            <>
              <div className="bg-[#f2f4fc] rounded-[16px] p-4 md:p-5 space-y-3 mb-5">
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">Service</span>
                  <span className="text-[14px] font-semibold text-[#111125]">
                    {service.title}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">Date</span>
                  <span className="text-[14px] font-semibold text-[#111125]">
                    {formatDateFr(selectedDate!)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">Creneau</span>
                  <span className="text-[14px] font-semibold text-[#111125]">
                    {selectedTime}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">{isKours ? 'Participants' : 'Convives'}</span>
                  <span className="text-[14px] font-semibold text-[#111125]">
                    {guests} personne{guests > 1 ? 's' : ''}
                  </span>
                </div>
                {isKours && service.koursDifficulty && (
                  <div className="flex justify-between items-center">
                    <span className="text-[14px] text-[#6b7280]">Niveau</span>
                    <span className="text-[14px] font-semibold text-[#111125]">{service.koursDifficulty}</span>
                  </div>
                )}
                {isKours && service.koursLocation && (
                  <div className="flex justify-between items-center">
                    <span className="text-[14px] text-[#6b7280]">Lieu du cours</span>
                    <span className="text-[14px] font-semibold text-[#111125]">{service.koursLocation}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#6b7280]">
                    {isKours ? 'Prix du cours (1-6 élèves)' : 'Prix unitaire'}
                  </span>
                  <span className="text-[14px] font-semibold text-[#111125]">
                    {isKours
                      ? `${formatPrice(service.priceInCents)}\u20AC`
                      : `${formatPrice(service.priceInCents)}\u20AC x ${guests}`
                    }
                  </span>
                </div>
                {isKours && guests > 6 && (
                  <div className="flex justify-between items-center">
                    <span className="text-[14px] text-[#6b7280]">
                      Supplément ({guests - 6} élève{guests - 6 > 1 ? 's' : ''} en plus)
                    </span>
                    <span className="text-[14px] font-semibold text-[#111125]">
                      +{formatPrice((service.extraGuestPriceInCents ?? 0) * (guests - 6))}&euro;
                    </span>
                  </div>
                )}
                {notes.trim() && (
                  <div className="flex justify-between items-start">
                    <span className="text-[14px] text-[#6b7280]">Notes</span>
                    <span className="text-[14px] text-[#111125] max-w-[60%] text-right">
                      {notes.trim()}
                    </span>
                  </div>
                )}
                <div className="border-t border-[#e5e7eb] pt-3 flex justify-between items-center">
                  <span className="text-[16px] font-bold text-[#111125]">Total</span>
                  <span className="text-[22px] font-bold text-[#c1a0fd]">
                    {formatPrice(totalPriceCents)}&euro;
                  </span>
                </div>
              </div>

              <button
                onClick={handleReserveClick}
                disabled={isSubmitting || stripeLoading}
                className="w-full py-3.5 bg-[#c1a0fd] text-white font-semibold rounded-[12px] hover:bg-[#b090ed] transition-all text-[16px] shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting || stripeLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {stripeLoading ? 'Chargement...' : 'Réservation en cours...'}
                  </>
                ) : (
                  <>Confirmer la reservation — {formatPrice(totalPriceCents)}&euro;</>
                )}
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
