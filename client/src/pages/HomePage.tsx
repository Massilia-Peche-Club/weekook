import { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Search, ChevronLeft, ChevronRight, Star, Quote } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import ServiceCard from '@/components/common/ServiceCard';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import heroImage from '@/assets/d44ea553455097a6377797d27e1f725103cf1bcf.png';
import kookerImage from '@/assets/daf59a7b2f5cb369dff77dcdb101b9bb2386564d.png';
import { usePageTiming } from '@/hooks/usePageTiming';

// ─── Placeholder images for kooker cards ────────────────────────────────────

const KOOKER_PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1496952286950-c36951138af4?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1729774092918-f1b7c595cce1?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1760445528879-010bd4b7660b?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1617307744152-60bf7d1da3f8?w=600&h=400&fit=crop',
];

// ─── API response types ─────────────────────────────────────────────────────

interface ApiService {
  id: number;
  title: string;
  type: unknown;
  priceInCents: number;
  durationMinutes: number;
  images: { id: number; url: string; isCardImage: boolean; sortOrder: number }[];
  kookerProfile: {
    id: number;
    city: string;
    rating: number;
    reviewCount: number;
    user: { id: number; firstName: string; lastName: string; avatar: string | null };
  };
}

interface ServicesResponse {
  services: ApiService[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface ApiTestimonial {
  id: number;
  authorName: string;
  authorRole: string;
  content: string;
  rating: number;
  kookerProfile?: { user: { firstName: string; lastName: string } };
}

// ─── Display types ──────────────────────────────────────────────────────────

interface DisplayService {
  id: number;
  title: string;
  type: string[];
  priceInCents: number;
  durationMinutes: number;
  cardImageUrl: string | null;
  kooker: {
    id: number;
    name: string;
    avatarUrl: string;
    city: string;
    rating: number;
    reviewCount: number;
  };
}

interface DisplayTestimonial {
  id: number;
  name: string;
  location: string;
  avatar: string;
  quote: string;
  rating: number;
}

const TYPEWRITER_WORDS = ['Couscous', 'cuisine vietnamienne', 'Marseille Paella géante'];

const FAQ_ITEMS = [
  {
    question: 'Comment fonctionne Weekook ?',
    answer:
      "Weekook met en relation des passionnés de cuisine (les Kookers) avec des particuliers et des entreprises. Parcourez les profils de nos Kookers, découvrez leurs spécialités et leurs offres, puis réservez directement en ligne. Le Kooker se déplace chez vous ou dans le lieu de votre choix pour préparer un repas sur mesure. C'est simple, convivial et délicieux !",
  },
  {
    question: 'Quels types d\'offres sont disponibles sur la plateforme ?',
    answer:
      "Nos Kookers proposent une grande variété d'offres : des repas à domicile pour des événements (anniversaires, mariages, team building), des cours de cuisine personnalisés, des préparations de batch cooking pour la semaine, et même des ateliers thématiques. Chaque Kooker définit ses propres offres avec ses tarifs et ses spécialités.",
  },
  {
    question: 'Comment devenir kooker sur Weekook ?',
    answer:
      "Devenir Kooker est simple et gratuit ! Créez votre compte sur la plateforme, puis remplissez le formulaire \"Devenir Kooker\" en renseignant vos spécialités, votre expérience et votre zone géographique. Une fois votre profil validé, vous pouvez créer vos offres et commencer à recevoir des réservations. Aucun diplôme de cuisine n'est requis, seule la passion compte !",
  },
  {
    question: 'Comment sont garanties la qualité et la sécurité ?',
    answer:
      "La sécurité et la qualité sont au cœur de notre plateforme. Chaque Kooker est vérifié lors de son inscription. Les avis et notes des clients sont publiés en toute transparence. Nous proposons également une assurance responsabilité civile pour chaque prestation. En cas de problème, notre service client est disponible 7j/7 pour vous accompagner.",
  },
  {
    question: 'Quels sont les tarifs et comment ça se passe pour les paiements ?',
    answer:
      "Les tarifs sont fixés librement par chaque Kooker en fonction de ses offres. Le paiement s'effectue en ligne de manière sécurisée lors de la réservation. Le montant est bloqué jusqu'à la réalisation de la prestation, puis reversé au Kooker. Weekook prélève une commission de service transparente. Aucun frais caché !",
  },
];

// ─── Typewriter Hook ────────────────────────────────────────────────────────

function useTypewriter(words: string[], typingSpeed = 100, deletingSpeed = 60, pauseTime = 2000) {
  const [displayText, setDisplayText] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentWord = words[wordIndex];

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          setDisplayText(currentWord.slice(0, displayText.length + 1));
          if (displayText.length + 1 === currentWord.length) {
            setTimeout(() => setIsDeleting(true), pauseTime);
          }
        } else {
          setDisplayText(currentWord.slice(0, displayText.length - 1));
          if (displayText.length === 0) {
            setIsDeleting(false);
            setWordIndex((prev) => (prev + 1) % words.length);
          }
        }
      },
      isDeleting ? deletingSpeed : typingSpeed
    );

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, wordIndex, words, typingSpeed, deletingSpeed, pauseTime]);

  return displayText;
}

// ─── HomePage Component ─────────────────────────────────────────────────────

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [featuredServices, setFeaturedServices] = useState<DisplayService[]>([]);
  const [testimonials, setTestimonials] = useState<DisplayTestimonial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  usePageTiming('Accueil', !isLoading);

  // Testimonial submission modal
  const [showTestimonialModal, setShowTestimonialModal] = useState(false);
  const [testimonialName, setTestimonialName] = useState('');
  const [testimonialRole, setTestimonialRole] = useState('');
  const [testimonialContent, setTestimonialContent] = useState('');
  const [testimonialRating, setTestimonialRating] = useState(5);
  const [testimonialHovered, setTestimonialHovered] = useState(0);
  const [testimonialSubmitting, setTestimonialSubmitting] = useState(false);
  const [testimonialSent, setTestimonialSent] = useState(false);

  const typewriterText = useTypewriter(TYPEWRITER_WORDS, 80, 50, 1800);

  // Fetch kookers and testimonials on mount
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [servicesRes, testimonialsRes] = await Promise.all([
          api.get<ServicesResponse>('/services/search?featured=true&limit=4'),
          api.get<ApiTestimonial[]>('/testimonials'),
        ]);

        const parseJsonField = (val: unknown): string[] => {
          if (Array.isArray(val)) return val;
          try {
            const parsed = JSON.parse(val as string);
            return Array.isArray(parsed) ? parsed : JSON.parse(parsed);
          } catch { return []; }
        };
        const toUrl = (raw: string | null | undefined): string => {
          if (!raw) return '';
          if (raw.startsWith('http') || raw.startsWith('/')) return raw;
          return `/uploads/${raw}`;
        };

        if (servicesRes.success && servicesRes.data) {
          const mapped: DisplayService[] = servicesRes.data.services.map((s) => {
            const typeArr = parseJsonField(s.type);
            const cardImg = s.images.find((img) => img.isCardImage) || s.images[0];
            const cardImageUrl = cardImg ? toUrl(cardImg.url) : null;
            const avatarUrl = toUrl(s.kookerProfile.user.avatar);
            return {
              id: s.id,
              title: s.title,
              type: typeArr,
              priceInCents: s.priceInCents,
              durationMinutes: s.durationMinutes,
              cardImageUrl: cardImageUrl || avatarUrl || KOOKER_PLACEHOLDER_IMAGES[s.id % KOOKER_PLACEHOLDER_IMAGES.length],
              kooker: {
                id: s.kookerProfile.id,
                name: `${s.kookerProfile.user.firstName} ${s.kookerProfile.user.lastName}`,
                avatarUrl,
                city: s.kookerProfile.city || '',
                rating: s.kookerProfile.rating ?? 0,
                reviewCount: s.kookerProfile.reviewCount ?? 0,
              },
            };
          });
          setFeaturedServices(mapped);
        }

        if (testimonialsRes.success && testimonialsRes.data) {
          const mapped: DisplayTestimonial[] = testimonialsRes.data.map((t, index) => ({
            id: t.id,
            name: t.authorName,
            location: t.authorRole || '',
            avatar: `https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&sig=${index}`,
            quote: t.content,
            rating: t.rating,
          }));
          setTestimonials(mapped);
        }
      } catch (err) {
        console.error('Failed to fetch homepage data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  // Number of visible testimonials based on screen (we always render 3 for desktop)
  const visibleCount = 3;
  const maxIndex = Math.max(0, testimonials.length - visibleCount);

  const handlePrevTestimonial = useCallback(() => {
    setTestimonialIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNextTestimonial = useCallback(() => {
    setTestimonialIndex((prev) => Math.min(maxIndex, prev + 1));
  }, [maxIndex]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (query) {
      navigate(`/recherche?q=${encodeURIComponent(query)}`);
    } else {
      navigate('/recherche');
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
    } catch (err: any) {
      toast.error(err?.error || 'Erreur lors de l\'envoi');
    } finally {
      setTestimonialSubmitting(false);
    }
  };

  const handleFaqToggle = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <>
    <div className="min-h-screen bg-[#f2f4fc]" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* ═══════════════════════ HERO SECTION ═══════════════════════ */}
      <section className="relative w-full h-[280px] md:h-[340px] lg:h-[520px] overflow-hidden">
        {/* Background Image */}
        <img
          src={heroImage}
          alt="Weekook hero"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 to-transparent" />

        {/* Hero Content */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 md:px-8 lg:px-[96px] text-center">
          <h1 className="font-black text-[28px] md:text-[36px] lg:text-[40px] text-white mb-4 leading-tight">
            WEEKOOK
          </h1>
          <p className="text-white/90 text-[14px] md:text-[16px] lg:text-[18px] max-w-[640px] leading-relaxed mb-8">
            Vous cherchez un passionné talentueux pour préparer une paella géante,
            un couscous familial ou un cours de pâtisserie ? Trouvez votre Kooker
            près de chez vous !
          </p>

          {/* Desktop Search Bar (positioned inside hero) */}
          <div className="hidden md:block w-full max-w-[648px]">
            <form onSubmit={handleSearch} className="relative">
              <div className="bg-[#f3f3f3] rounded-full h-[60px] md:h-[70px] lg:h-[83px] shadow-[0px_6.539px_6.539px_3.269px_rgba(0,0,0,0.25)] flex items-center px-6 lg:px-8">
                <div className="flex-1 relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-[#111125] text-[16px] lg:text-[18px] font-medium outline-none placeholder:text-[#9ca3af]"
                    placeholder=""
                  />
                  {/* Typewriter placeholder (only visible when input is empty) */}
                  {!searchQuery && (
                    <div className="absolute inset-0 flex items-center pointer-events-none">
                      <span className="text-[#9ca3af] text-[16px] lg:text-[18px] font-medium">
                        {typewriterText}
                        <span className="animate-pulse">|</span>
                      </span>
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  className="bg-[#c1a0fd] hover:bg-[#b090ed] rounded-full size-[48px] md:size-[56px] lg:size-[60px] flex items-center justify-center transition-colors cursor-pointer flex-shrink-0 ml-4"
                  aria-label="Rechercher"
                >
                  <Search className="w-[22px] h-[22px] lg:w-[26px] lg:h-[26px] text-white" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Mobile Search Bar (below hero) */}
      <div className="md:hidden px-4 -mt-[30px] relative z-20 mb-6">
        <form onSubmit={handleSearch} className="relative">
          <div className="bg-[#f3f3f3] rounded-full h-[60px] shadow-[0px_6.539px_6.539px_3.269px_rgba(0,0,0,0.25)] flex items-center px-4">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-[#111125] text-[15px] font-medium outline-none placeholder:text-[#9ca3af]"
                placeholder=""
              />
              {!searchQuery && (
                <div className="absolute inset-0 flex items-center pointer-events-none">
                  <span className="text-[#9ca3af] text-[15px] font-medium">
                    {typewriterText}
                    <span className="animate-pulse">|</span>
                  </span>
                </div>
              )}
            </div>
            <button
              type="submit"
              className="bg-[#c1a0fd] hover:bg-[#b090ed] rounded-full size-[48px] flex items-center justify-center transition-colors cursor-pointer flex-shrink-0 ml-3"
              aria-label="Rechercher"
            >
              <Search className="w-[22px] h-[22px] text-white" />
            </button>
          </div>
        </form>
      </div>

      {/* ═══════════════════════ KOOKERS SECTION ═══════════════════════ */}
      <section className="px-4 md:px-8 lg:px-[96px] py-[48px] md:py-[64px] lg:py-[80px]">
        {/* Section Header */}
        <div className="text-center mb-10 md:mb-14">
          <p className="text-[#cdb3fd] text-[14px] md:text-[16px] tracking-[2.56px] uppercase font-semibold mb-3">
            NOS OFFRES
          </p>
          <h2 className="text-[#111125] text-[28px] md:text-[36px] lg:text-[40px] font-semibold leading-tight mb-4">
            Nos prestations à la une
          </h2>
          <p className="text-[#5c5c6f] text-[15px] md:text-[16px] max-w-[520px] mx-auto">
            Les meilleures offres sélectionnées pour vous
          </p>
        </div>

        {/* Kooker Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 justify-items-center mb-10 md:mb-14">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-[429px] w-full max-w-[286px] bg-[#f8f9fc] rounded-[20px] animate-pulse"
              >
                <div className="w-full h-[220px] p-3">
                  <div className="w-full h-full rounded-[24px] bg-[#e6d9fe]/40" />
                </div>
                <div className="px-4 pb-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-[40px] h-[40px] rounded-full bg-[#e6d9fe]/40" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-[#e6d9fe]/40 rounded w-3/4" />
                      <div className="h-3 bg-[#e6d9fe]/40 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="h-6 bg-[#e6d9fe]/40 rounded-full w-16" />
                    <div className="h-6 bg-[#e6d9fe]/40 rounded-full w-14" />
                    <div className="h-6 bg-[#e6d9fe]/40 rounded-full w-12" />
                  </div>
                </div>
              </div>
            ))
          ) : (
            featuredServices.map((service) => (
              <ServiceCard
                key={service.id}
                id={service.id}
                title={service.title}
                type={service.type}
                priceInCents={service.priceInCents}
                durationMinutes={service.durationMinutes}
                cardImageUrl={service.cardImageUrl}
                kooker={service.kooker}
              />
            ))
          )}
        </div>

        {/* CTA Button */}
        <div className="text-center">
          <button
            onClick={() => navigate('/recherche')}
            className="h-[52px] px-8 rounded-[12px] bg-[#c1a0fd] hover:bg-[#b090ed] text-white font-semibold text-[16px] transition-colors cursor-pointer"
          >
            Voir toutes les prestations
          </button>
        </div>
      </section>

      {/* ═══════════════════════ KOOK / KOURS SECTION ═══════════════════════ */}
      <section className="px-4 md:px-8 lg:px-[96px] pb-[48px] md:pb-[64px]">
        <div className="text-center mb-8">
          <p className="text-[#cdb3fd] text-[14px] tracking-[2.56px] uppercase font-semibold mb-3">LES 2 TYPES DE PRESTATION</p>
          <h2 className="text-[#111125] text-[26px] md:text-[32px] font-semibold leading-tight">
            KOOK ou KOURS ?
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[860px] mx-auto">
          {/* KOOK */}
          <div className="bg-white rounded-[20px] p-6 md:p-8 shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="text-[32px]">🍽️</span>
              <div>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#ffe4b5] text-[#a05a00] text-[12px] font-bold uppercase tracking-wide">KOOK</span>
              </div>
            </div>
            <h3 className="text-[20px] font-bold text-[#111125]">Repas à domicile</h3>
            <p className="text-[14px] text-[#5c5c6f] leading-relaxed">
              Le Kooker se déplace chez vous pour préparer un repas complet. Vous n'avez rien à faire : il cuisine, dresse les assiettes et repart en laissant votre cuisine propre. Idéal pour les dîners en famille, les soirées entre amis ou les événements d'entreprise.
            </p>
            <button
              onClick={() => navigate('/recherche?type=KOOK')}
              className="mt-auto h-[44px] px-6 rounded-[12px] bg-[#f3ecff] text-[#c1a0fd] font-semibold text-[14px] hover:bg-[#c1a0fd] hover:text-white transition-all cursor-pointer"
            >
              Découvrir les KOOK
            </button>
          </div>
          {/* KOURS */}
          <div className="bg-white rounded-[20px] p-6 md:p-8 shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="text-[32px]">👨‍🍳</span>
              <div>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#d1f5d3] text-[#1a7c2a] text-[12px] font-bold uppercase tracking-wide">KOURS</span>
              </div>
            </div>
            <h3 className="text-[20px] font-bold text-[#111125]">Cours de cuisine</h3>
            <p className="text-[14px] text-[#5c5c6f] leading-relaxed">
              Un Kooker passionné vous enseigne ses techniques et recettes. Seul, en duo ou en groupe, apprenez à cuisiner un plat spécifique dans une ambiance conviviale. Repartez avec les recettes et les bons gestes !
            </p>
            <button
              onClick={() => navigate('/recherche?type=COURS')}
              className="mt-auto h-[44px] px-6 rounded-[12px] bg-[#f3ecff] text-[#c1a0fd] font-semibold text-[14px] hover:bg-[#c1a0fd] hover:text-white transition-all cursor-pointer"
            >
              Découvrir les KOURS
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ TESTIMONIALS SECTION ═══════════════════════ */}
      <section className="px-4 md:px-8 lg:px-[96px] py-[48px] md:py-[64px] lg:py-[80px]">
        <div className="bg-[#f8f9fc] rounded-[24px] px-6 md:px-10 lg:px-14 py-10 md:py-14 lg:py-16">
          {/* Section Header */}
          <div className="text-center mb-10 md:mb-14">
            <p className="text-[#cdb3fd] text-[14px] md:text-[16px] tracking-[2.56px] uppercase font-semibold mb-3">
              ON EN PARLE
            </p>
            <h2 className="text-[#111125] text-[28px] md:text-[36px] lg:text-[40px] font-semibold leading-tight mb-4">
              Ce que disent nos utilisateurs
            </h2>
            <p className="text-[#5c5c6f] text-[15px] md:text-[16px] max-w-[560px] mx-auto">
              Découvrez les avis et les expériences de notre communauté WEEKOOK !
            </p>
          </div>

          {/* Carousel */}
          <div className="relative overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={testimonialIndex}
                initial={{ opacity: 0, x: 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -60 }}
                transition={{ duration: 0.35, ease: 'easeInOut' }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {testimonials.slice(testimonialIndex, testimonialIndex + visibleCount).map(
                  (testimonial) => (
                    <div
                      key={testimonial.id}
                      className="bg-white rounded-[12px] p-6 md:p-8 flex flex-col gap-4 shadow-sm"
                    >
                      {/* Quote Icon */}
                      <div className="flex items-center gap-1 mb-1">
                        <Quote className="w-[28px] h-[28px] text-[#c1a0fd] fill-[#c1a0fd] opacity-30" />
                      </div>

                      {/* Stars */}
                      <div className="flex items-center gap-1">
                        {Array.from({ length: testimonial.rating }).map((_, i) => (
                          <Star
                            key={i}
                            className="w-[16px] h-[16px] text-[#fbbf24] fill-[#fbbf24]"
                          />
                        ))}
                      </div>

                      {/* Quote Text */}
                      <p className="text-[#5c5c6f] text-[14px] md:text-[15px] leading-relaxed flex-1">
                        "{testimonial.quote}"
                      </p>

                      {/* Author */}
                      <div className="flex items-center gap-3 mt-2 pt-4 border-t border-[#f0f0f0]">
                        <div className="w-[44px] h-[44px] rounded-full overflow-hidden flex-shrink-0">
                          <img
                            src={testimonial.avatar}
                            alt={testimonial.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-[14px] text-[#111125]">
                            {testimonial.name}
                          </span>
                          <span className="text-[12px] text-[#9ca3af]">
                            {testimonial.location}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={handlePrevTestimonial}
              disabled={testimonialIndex === 0}
              className="w-[48px] h-[48px] rounded-full bg-[#f3ecff] hover:bg-[#e6d9fe] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Témoignage précédent"
            >
              <ChevronLeft className="w-[22px] h-[22px] text-[#c1a0fd]" />
            </button>
            <button
              onClick={handleNextTestimonial}
              disabled={testimonialIndex >= maxIndex}
              className="w-[48px] h-[48px] rounded-full bg-[#c1a0fd] hover:bg-[#b090ed] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Témoignage suivant"
            >
              <ChevronRight className="w-[22px] h-[22px] text-white" />
            </button>
          </div>

          {/* CTA témoignage */}
          {user && (
            <div className="text-center mt-8">
              {testimonialSent ? (
                <span className="text-[14px] font-medium text-green-600">✓ Témoignage envoyé — merci !</span>
              ) : (
                <button
                  onClick={openTestimonialModal}
                  className="inline-flex items-center gap-2 px-5 py-2.5 border border-[#c1a0fd] text-[#c1a0fd] hover:bg-[#f3ecff] text-[14px] font-semibold rounded-[12px] transition-all"
                >
                  <Star className="w-4 h-4 fill-[#c1a0fd] text-[#c1a0fd]" />
                  Partager votre expérience
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════ CTA KOOKER SECTION ═══════════════════════ */}
      {!user?.kookerProfileId && (
      <section className="px-4 md:px-8 lg:px-[96px] py-[48px] md:py-[64px] lg:py-[80px]">
        <div className="relative w-full rounded-[24px] overflow-hidden min-h-[400px] md:min-h-[460px] lg:min-h-[520px]">
          {/* Background Image */}
          <img
            src={kookerImage}
            alt="Devenir Kooker"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent" />

          {/* Content */}
          <div className="relative z-10 flex flex-col justify-center h-full min-h-[400px] md:min-h-[460px] lg:min-h-[520px] px-6 md:px-10 lg:px-16 py-10 max-w-[640px]">
            <p className="text-[#cdb3fd] text-[14px] md:text-[16px] tracking-[2.56px] uppercase font-semibold mb-3">
              JE SUIS UN KOOKER !
            </p>
            <h2 className="text-[#111125] text-[28px] md:text-[36px] lg:text-[40px] font-semibold leading-tight mb-5">
              Envie de partager votre savoir-faire ? Rejoignez Weekook !
            </h2>
            <p className="text-[#5c5c6f] text-[14px] md:text-[15px] leading-relaxed mb-8">
              Vous êtes passionné de cuisine et souhaitez partager vos talents ?
              Inscrivez-vous gratuitement sur Weekook et proposez vos services
              culinaires à une communauté de gourmands. Définissez vos offres, vos
              tarifs et vos disponibilités. Nous nous occupons du reste : mise en
              relation, paiement sécurisé et visibilité auprès de milliers
              d'utilisateurs.
            </p>
            <div className="flex flex-wrap gap-4">
              {user ? (
                <button
                  onClick={() => navigate('/devenir-kooker')}
                  className="h-[52px] px-8 rounded-[12px] bg-[#c1a0fd] hover:bg-[#b090ed] text-white font-semibold text-[15px] transition-colors cursor-pointer"
                >
                  Devenir Kooker
                </button>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/connexion')}
                    className="h-[52px] px-8 rounded-[12px] bg-[#c1a0fd] hover:bg-[#b090ed] text-white font-semibold text-[15px] transition-colors cursor-pointer"
                  >
                    S'inscrire gratuitement
                  </button>
                  <button
                    onClick={() => navigate('/connexion')}
                    className="h-[52px] px-8 rounded-[12px] border-2 border-[#c1a0fd] text-[#c1a0fd] hover:bg-[#c1a0fd] hover:text-white font-semibold text-[15px] transition-colors cursor-pointer"
                  >
                    Se connecter
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ═══════════════════════ FAQ SECTION ═══════════════════════ */}
      <section className="px-4 md:px-8 lg:px-[96px] py-[48px] md:py-[64px] lg:py-[80px]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
          {/* Left Column - Text + CTA */}
          <div className="flex flex-col justify-start">
            <p className="text-[#cdb3fd] text-[14px] md:text-[16px] tracking-[2.56px] uppercase font-semibold mb-3">
              DES INFOS ?
            </p>
            <h2 className="text-[#111125] text-[28px] md:text-[36px] lg:text-[40px] font-semibold leading-tight mb-5">
              Vous avez des questions ? On peut certainement y répondre :)
            </h2>
            <p className="text-[#5c5c6f] text-[14px] md:text-[15px] leading-relaxed mb-8">
              Consultez notre FAQ pour trouver des réponses aux questions les plus
              fréquentes. Si vous ne trouvez pas ce que vous cherchez, n'hésitez pas
              à nous contacter directement. Notre équipe est là pour vous aider !
            </p>
            <div className="flex flex-wrap gap-4">
              {!user && (
                <button
                  onClick={() => navigate('/connexion')}
                  className="h-[52px] px-8 rounded-[12px] bg-[#c1a0fd] hover:bg-[#b090ed] text-white font-semibold text-[15px] transition-colors cursor-pointer"
                >
                  Je m'inscris
                </button>
              )}
              <button
                onClick={() => navigate('/faq')}
                className="h-[52px] px-8 rounded-[12px] border-2 border-[#c1a0fd] text-[#c1a0fd] hover:bg-[#c1a0fd] hover:text-white font-semibold text-[15px] transition-colors cursor-pointer"
              >
                En savoir plus
              </button>
            </div>
          </div>

          {/* Right Column - Accordion */}
          <div className="flex flex-col gap-3">
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div
                  key={index}
                  className={`rounded-[16px] border-2 transition-all duration-300 ${
                    isOpen
                      ? 'bg-[#f2f4fc] border-[#c1a0fd]'
                      : 'bg-[#f8f9fc] border-[#e6d9fe]'
                  }`}
                >
                  {/* Question */}
                  <button
                    onClick={() => handleFaqToggle(index)}
                    className="w-full flex items-center justify-between p-5 md:p-6 cursor-pointer text-left"
                  >
                    <span
                      className={`font-semibold text-[15px] md:text-[16px] pr-4 transition-colors ${
                        isOpen ? 'text-[#111125]' : 'text-[#303044]'
                      }`}
                    >
                      {item.question}
                    </span>
                    {/* Plus / Close Icon */}
                    <div
                      className={`flex-shrink-0 w-[32px] h-[32px] md:w-[36px] md:h-[36px] rounded-full flex items-center justify-center transition-colors ${
                        isOpen ? 'bg-[#c1a0fd]' : 'bg-[#e6d9fe]'
                      }`}
                    >
                      {isOpen ? (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M12 4L4 12M4 4L12 12"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M8 3V13M3 8H13"
                            stroke="#c1a0fd"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  </button>

                  {/* Answer with smooth transition */}
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="px-5 md:px-6 pb-5 md:pb-6">
                      <p className="text-[#5c5c6f] text-[14px] md:text-[15px] leading-relaxed">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
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

          {/* Name */}
          <div className="mb-3">
            <label className="block text-[13px] font-semibold text-[#111125] mb-1.5">Nom affiché</label>
            <input
              type="text"
              value={testimonialName}
              onChange={e => setTestimonialName(e.target.value)}
              placeholder="Sophie L."
              className="w-full h-[44px] rounded-[12px] border border-[#e0e2ef] px-4 text-[14px] text-[#111125] focus:outline-none focus:ring-2 focus:ring-[#c1a0fd] focus:border-transparent"
            />
          </div>

          {/* Role */}
          <div className="mb-3">
            <label className="block text-[13px] font-semibold text-[#111125] mb-1.5">Votre profil <span className="font-normal text-[#9ca3af]">(facultatif)</span></label>
            <input
              type="text"
              value={testimonialRole}
              onChange={e => setTestimonialRole(e.target.value)}
              placeholder="Cliente depuis 2024, Fan de cuisine italienne…"
              className="w-full h-[44px] rounded-[12px] border border-[#e0e2ef] px-4 text-[14px] text-[#111125] focus:outline-none focus:ring-2 focus:ring-[#c1a0fd] focus:border-transparent"
            />
          </div>

          {/* Content */}
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
    </>
  );
}
