import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { compressImage } from '@/lib/compressImage';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import {
  ArrowLeft,
  GraduationCap,
  CookingPot,
  Plus,
  X,
  Upload,
  Lock,
  Trash2,
  Loader2,
} from 'lucide-react';
import { usePageTiming } from '@/hooks/usePageTiming';

// ────────────────────────── Types ──────────────────────────

interface MenuItem {
  name: string;
  description: string;
}

// ────────────────────────── Allergens List ──────────────────────────

const ALL_ALLERGENS = [
  'Gluten', 'Lactose', 'Arachide',
  'Fruits à coques', 'Œuf', 'Fruits de mer', 'Autres / Je ne sais pas',
];

// ────────────────────────── Component ──────────────────────────

export default function EditMenuPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [isLoading, setIsLoading] = useState(true);
  const [availableSpecialties, setAvailableSpecialties] = useState<string[]>([]);
  const [availableUnits, setAvailableUnits] = useState<string[]>(['g', 'kg', 'mL', 'L', 'pcs', 'cs', 'cc', 'pincée', 'tranche(s)', 'unité(s)']);
  const [tooltipFruitsDesMer, setTooltipFruitsDesMer] = useState("produits de la mer à l'exception des poissons");
  const [tooltipCommission, setTooltipCommission] = useState("La commission Weekook est prélevée sur chaque réservation. Elle couvre les frais de la plateforme, le paiement sécurisé et l'assistance client.");
  const [commissionKours, setCommissionKours] = useState(20);
  const [commissionKook, setCommissionKook] = useState(20);
  const [kookBaseGuests, setKookBaseGuests] = useState(6);
  usePageTiming('Modifier une offre', !isLoading);

  // Service type selection
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);

  // COURS fields
  const [koursTitle, setKoursTitle] = useState('');
  const [koursDescription, setKoursDescription] = useState('');
  const [koursPrice, setKoursPrice] = useState('');
  const [koursExtraGuestPrice, setKoursExtraGuestPrice] = useState('');
  const [koursDuration, setKoursDuration] = useState('');
  const [koursMaxParticipants, setKoursMaxParticipants] = useState('');
  const [koursDifficulty, setKoursDifficulty] = useState('Débutant');

  // KOOK fields
  const [kookTitle, setKookTitle] = useState('');
  const [kookDescription, setKookDescription] = useState('');
  const [kookPrice, setKookPrice] = useState('');
  const [kookExtraGuestPrice, setKookExtraGuestPrice] = useState('');
  const [kookDuration, setKookDuration] = useState('');
  const [kookMaxParticipants, setKookMaxParticipants] = useState('');

  // Champs partagés — Ingrédients (fournis par le client)
  const [ingredientsList, setIngredientsList] = useState<{ name: string; quantity: string; unit: string }[]>([]);
  const [ingredientsBaseServings, setIngredientsBaseServings] = useState(1);
  const [newIngName, setNewIngName] = useState('');
  const [newIngQty, setNewIngQty] = useState('');
  const [newIngUnit, setNewIngUnit] = useState('g');

  // Matériel fourni par le kooker
  const [equipmentKooker, setEquipmentKooker] = useState<string[]>([]);
  const [newEquipmentKooker, setNewEquipmentKooker] = useState('');

  // Matériel à fournir par le client
  const [equipmentClient, setEquipmentClient] = useState<string[]>([]);
  const [newEquipmentClient, setNewEquipmentClient] = useState('');

  // Common fields
  const [photos, setPhotos] = useState<string[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [allergens, setAllergens] = useState<string[]>([]);
  const [isVegetarian, setIsVegetarian] = useState(false);
  const [isVegan, setIsVegan] = useState(false);
  const [isPorkFree, setIsPorkFree] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // ────────────────────────── Load Service ──────────────────────────

  useEffect(() => {
    document.title = 'Modifier une offre - Weekook';

    api.get<{ commissionKours: number; commissionKook: number; specialties: string[]; kookBaseGuests: number; units: string[]; tooltipFruitsDesMer?: string; tooltipCommission?: string }>('/admin/config/public').then(res => {
      if (res.success && res.data) {
        if (Array.isArray(res.data.specialties)) setAvailableSpecialties(res.data.specialties);
        if (typeof res.data.commissionKours === 'number') setCommissionKours(res.data.commissionKours);
        if (typeof res.data.commissionKook === 'number') setCommissionKook(res.data.commissionKook);
        if (typeof res.data.kookBaseGuests === 'number') setKookBaseGuests(res.data.kookBaseGuests);
        if (Array.isArray(res.data.units) && res.data.units.length > 0) setAvailableUnits(res.data.units);
        if (res.data.tooltipFruitsDesMer) setTooltipFruitsDesMer(res.data.tooltipFruitsDesMer);
        if (res.data.tooltipCommission) setTooltipCommission(res.data.tooltipCommission);
      }
    }).catch(() => {});

    const loadService = async () => {
      try {
        const res = await api.get<any>(`/services/${id}`);
        if (res.success && res.data) {
          const s = res.data;
          const types: string[] = Array.isArray(s.type) ? s.type : JSON.parse(s.type || '[]');
          setServiceTypes(types);

          // Populate COURS or KOOK fields based on type
          if (types.includes('COURS')) {
            setKoursTitle(s.title || '');
            setKoursDescription(s.description || '');
            setKoursPrice(String(s.priceInCents / 100));
            setKoursExtraGuestPrice(s.extraGuestPriceInCents != null ? String(s.extraGuestPriceInCents / 100) : '');
            setKoursDuration(String(s.durationMinutes || ''));
            setKoursMaxParticipants(String(s.maxGuests || ''));
            setKoursDifficulty(s.koursDifficulty || 'Débutant');
          }
          if (types.includes('KOOK')) {
            setKookTitle(s.title || '');
            setKookDescription(s.description || '');
            setKookPrice(String(s.priceInCents / 100));
            setKookExtraGuestPrice(s.extraGuestPriceInCents != null ? String(s.extraGuestPriceInCents / 100) : '');
            setKookDuration(String(s.durationMinutes || ''));
            setKookMaxParticipants(String(s.maxGuests || ''));
          }

          // Champs partagés
          const ingList = Array.isArray(s.ingredientsList) ? s.ingredientsList : (s.ingredientsList ? JSON.parse(s.ingredientsList) : []);
          setIngredientsList(ingList);
          if (s.ingredientsBaseServings != null) setIngredientsBaseServings(s.ingredientsBaseServings);
          const eqKooker = Array.isArray(s.equipmentKooker) ? s.equipmentKooker : (s.equipmentKooker ? JSON.parse(s.equipmentKooker) : []);
          setEquipmentKooker(eqKooker);
          const eqClient = Array.isArray(s.constraints) ? s.constraints : (s.constraints ? JSON.parse(s.constraints) : []);
          setEquipmentClient(eqClient);

          setAllergens(Array.isArray(s.allergens) ? s.allergens : JSON.parse(s.allergens || '[]'));
          setSpecialties(Array.isArray(s.specialty) ? s.specialty : (s.specialty ? JSON.parse(s.specialty) : []));

          // Load existing images
          if (s.images && Array.isArray(s.images) && s.images.length > 0) {
            setPhotos(s.images.map((img: any) => img.url));
          }

        }
      } catch {
        toast.error('Erreur lors du chargement');
        navigate('/kooker-dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    loadService();
  }, [id]);

  // ────────────────────────── Type Toggle ──────────────────────────

  const toggleType = (type: string) => {
    setServiceTypes((prev) => {
      const next = prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type];
      if (next.length === 2) {
        toast.info('La 2ème offre est visible sous la première, en scrollant');
      }
      return next;
    });
  };

  // ────────────────────────── COURS completeness ──────────────────────────

  const isKoursComplete =
    koursTitle.trim() !== '' &&
    koursDescription.trim() !== '' &&
    koursPrice.trim() !== '' &&
    koursExtraGuestPrice.trim() !== '' &&
    koursDuration.trim() !== '' &&
    koursMaxParticipants.trim() !== '';

  const isKookDisabled = serviceTypes.includes('COURS') && serviceTypes.includes('KOOK') && !isKoursComplete;

  // ────────────────────────── Menu Items Helpers ──────────────────────────

  // ────────────────────────── Specialties ──────────────────────────

  const addSpecialty = () => {
    const val = newSpecialty.trim();
    if (!val || specialties.includes(val)) return;
    setSpecialties((prev) => [...prev, val]);
    setNewSpecialty('');
  };

  const removeSpecialty = (s: string) => {
    setSpecialties((prev) => prev.filter((x) => x !== s));
  };

  // ────────────────────────── Photo Helpers ──────────────────────────

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setIsUploadingPhoto(true);
    try {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append('file', compressed);
      const res = await api.upload<{ url: string }>('/upload', formData);
      if (res.success && res.data?.url) {
        setPhotos((prev) => [...prev, res.data!.url]);
      } else {
        toast.error('Erreur lors de l\'upload de la photo');
      }
    } catch {
      toast.error('Impossible d\'uploader la photo. Réessayez.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  // ────────────────────────── Allergens ──────────────────────────

  const toggleAllergen = (a: string) => {
    setAllergens((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };

  // ────────────────────────── Ingredient Scaling ──────────────────────────

  const scaleIngredients = (newCount: number) => {
    if (ingredientsBaseServings <= 0 || newCount <= 0 || ingredientsList.length === 0) {
      setIngredientsBaseServings(newCount);
      return;
    }
    const ratio = newCount / ingredientsBaseServings;
    setIngredientsList((prev) =>
      prev.map((ing) => {
        const qty = parseFloat(ing.quantity);
        if (isNaN(qty)) return ing;
        const scaled = qty * ratio;
        const formatted = Number.isInteger(scaled) ? String(scaled) : parseFloat(scaled.toFixed(2)).toString();
        return { ...ing, quantity: formatted };
      })
    );
    setIngredientsBaseServings(newCount);
  };

  // ────────────────────────── Submit ──────────────────────────

  const canSubmit = serviceTypes.length > 0 && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const type = serviceTypes[0];
      const isKours = type === 'COURS';
      const data = {
        title: isKours ? koursTitle : kookTitle,
        description: isKours ? koursDescription : kookDescription,
        type: serviceTypes,
        priceInCents: Math.round(parseFloat(isKours ? koursPrice : kookPrice) * 100),
        extraGuestPriceInCents: isKours
          ? Math.round(parseFloat(koursExtraGuestPrice) * 100)
          : (kookExtraGuestPrice ? Math.round(parseFloat(kookExtraGuestPrice) * 100) : undefined),
        durationMinutes: parseInt(isKours ? koursDuration : kookDuration),
        maxGuests: parseInt(isKours ? koursMaxParticipants : kookMaxParticipants),
        allergens: allergens,
        specialty: specialties.length > 0 ? specialties : [],
        ingredientsList: ingredientsList.length > 0 ? ingredientsList : undefined,
        ingredientsBaseServings: ingredientsList.length > 0 ? ingredientsBaseServings : undefined,
        equipmentKooker: equipmentKooker.length > 0 ? equipmentKooker : undefined,
        constraints: equipmentClient.length > 0 ? equipmentClient : undefined,
        koursDifficulty: isKours ? koursDifficulty : undefined,
        koursLocation: isKours ? 'Chez le client' : undefined,
        images: photos,
      };
      await api.put(`/services/${id}`, data);
      toast.success('Service modifié avec succès !');
      navigate('/kooker-dashboard', { state: { tab: 'services' } });
    } catch (err: unknown) {
      const e = err as { error?: string; details?: Record<string, string[]> };
      if (e?.details) {
        const msgs = Object.entries(e.details).map(([k, v]) => `${k}: ${v.join(', ')}`).join(' | ');
        toast.error(`Validation: ${msgs}`);
      } else {
        toast.error(e?.error || 'Erreur lors de la modification');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ────────────────────────── Input Style ──────────────────────────

  const inputClass =
    'w-full h-[48px] px-4 bg-[#f2f4fc] border border-[#e0e2ef] rounded-[12px] text-[14px] text-[#111125] placeholder:text-[#111125]/30 focus:outline-none focus:border-[#c1a0fd] focus:ring-2 focus:ring-[#c1a0fd]/20 transition-all';
  const textareaClass =
    'w-full px-4 py-3 bg-[#f2f4fc] border border-[#e0e2ef] rounded-[12px] text-[14px] text-[#111125] placeholder:text-[#111125]/30 focus:outline-none focus:border-[#c1a0fd] focus:ring-2 focus:ring-[#c1a0fd]/20 transition-all resize-none leading-relaxed';
  const labelClass = 'block text-[13px] font-medium text-[#111125] mb-1.5';

  // ────────────────────────── Loading State ──────────────────────────

  if (isLoading) {
    return <LoadingSpinner />;
  }

  // ────────────────────────── Render ──────────────────────────

  return (
    <div className="min-h-screen bg-[#f2f4fc] pb-28">
      <form onSubmit={handleSubmit}>
        <div className="max-w-[1000px] mx-auto px-4 md:px-8 py-8">
          {/* ── Header ── */}
          <div className="mb-8">
            <button
              type="button"
              onClick={() => navigate('/kooker-dashboard')}
              className="flex items-center gap-2 text-[13px] font-medium text-[#111125]/50 hover:text-[#c1a0fd] transition-colors mb-4"
            >
              <ArrowLeft size={16} />
              Retour au dashboard
            </button>
            <h1 className="text-[24px] md:text-[28px] font-bold text-[#111125]">Modifier cette offre</h1>
            <p className="text-[14px] text-[#111125]/50 mt-1">
              Modifiez les détails de votre service et enregistrez les changements.
            </p>
          </div>

          {/* ── Service Type Selection ── */}
          <div className="relative rounded-[20px] overflow-hidden mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-[#111125]/80 to-[#111125]/60" />
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: 'url(https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=1200&q=80)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />

            <div className="relative z-10 p-6 md:p-8">
              <h2 className="text-[18px] font-bold text-white mb-2">Type de service</h2>
              <p className="text-[14px] text-white/60 mb-6">
                Sélectionnez un ou deux types de service. Vous pouvez proposer les deux.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  type="button"
                  onClick={() => toggleType('COURS')}
                  className={`flex-1 flex items-center justify-center gap-3 h-[56px] rounded-[12px] text-[15px] font-semibold transition-all ${
                    serviceTypes.includes('COURS')
                      ? 'bg-[#c1a0fd] text-white shadow-lg shadow-[#c1a0fd]/30'
                      : 'bg-white/10 text-white/80 hover:bg-white/20 border border-white/20'
                  }`}
                >
                  <GraduationCap size={20} />
                  COURS
                </button>
                <button
                  type="button"
                  onClick={() => toggleType('KOOK')}
                  className={`flex-1 flex items-center justify-center gap-3 h-[56px] rounded-[12px] text-[15px] font-semibold transition-all ${
                    serviceTypes.includes('KOOK')
                      ? 'bg-[#c1a0fd] text-white shadow-lg shadow-[#c1a0fd]/30'
                      : 'bg-white/10 text-white/80 hover:bg-white/20 border border-white/20'
                  }`}
                >
                  <CookingPot size={20} />
                  KOOK
                </button>
              </div>
            </div>
          </div>

          {/* ── COURS Form ── */}
          {serviceTypes.includes('COURS') && (
            <div className="bg-white rounded-[16px] p-6 md:p-8 shadow-sm mb-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-[12px] bg-[#f3ecff] flex items-center justify-center">
                  <GraduationCap size={20} className="text-[#c1a0fd]" />
                </div>
                <div>
                  <h3 className="text-[24px] font-semibold text-[#111125] tracking-[-0.48px]">Service COURS - Cours de cuisine</h3>
                  <p className="text-[13px] text-[#111125]/50">Configurez les détails de votre cours</p>
                </div>
              </div>

              {/* Purple info box */}
              <div className="bg-[#f3ecff] rounded-[12px] p-4 mb-6">
                <p className="text-[14px] text-[#5c5c6f]">
                  Un cours de cuisine permet à vos clients d'apprendre vos recettes et techniques culinaires en votre compagnie.
                </p>
              </div>

              {/* Title */}
              <div className="mb-5">
                <label className={labelClass}>Titre du cours</label>
                <input
                  type="text"
                  value={koursTitle}
                  onChange={(e) => setKoursTitle(e.target.value)}
                  placeholder="ex: Cours de pâtes fraîches maison"
                  className={inputClass}
                />
              </div>

              {/* Description */}
              <div className="mb-5">
                <label className={labelClass}>Description</label>
                <textarea
                  value={koursDescription}
                  onChange={(e) => setKoursDescription(e.target.value)}
                  placeholder="Décrivez le contenu de votre cours, ce que les participants vont apprendre..."
                  rows={5}
                  className={textareaClass}
                />
              </div>

              {/* Price base + Extra guest price */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                <div>
                  <label className={labelClass}>Prix du cours — 1 à 6 élèves (EUR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={koursPrice}
                    onChange={(e) => setKoursPrice(e.target.value)}
                    placeholder="200.00"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Supplément par élève au-delà de 6 (EUR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={koursExtraGuestPrice}
                    onChange={(e) => setKoursExtraGuestPrice(e.target.value)}
                    placeholder="25.00"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Simulation de revenus COURS */}
              {koursPrice && !isNaN(parseFloat(koursPrice)) && parseFloat(koursPrice) > 0 && (
                <div className="bg-[#f3ecff] border border-[#c1a0fd]/30 rounded-[12px] px-4 py-4 mb-5">
                  <p className="text-[13px] font-semibold text-[#303044] mb-2 flex items-center gap-1.5">
                    Simulation de revenus — commission Weekook {commissionKours}%
                    <span
                      title={tooltipCommission}
                      className="text-[#828294] cursor-help"
                    >ⓘ</span>
                  </p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[13px] text-[#5c5c6f]">
                      <span>Prix du cours (payé par le client)</span>
                      <span className="font-semibold text-[#111125]">{parseFloat(koursPrice).toFixed(2).replace('.', ',')} €</span>
                    </div>
                    <div className="flex justify-between text-[13px] text-[#5c5c6f]">
                      <span>Commission Weekook ({commissionKours}%)</span>
                      <span className="text-red-500">− {(parseFloat(koursPrice) * commissionKours / 100).toFixed(2).replace('.', ',')} €</span>
                    </div>
                    <div className="border-t border-[#c1a0fd]/20 pt-1.5 flex justify-between text-[14px] font-bold text-[#111125]">
                      <span>Vous recevez</span>
                      <span className="text-[#c1a0fd]">{(parseFloat(koursPrice) * (1 - commissionKours / 100)).toFixed(2).replace('.', ',')} €</span>
                    </div>
                  </div>
                  {koursExtraGuestPrice && !isNaN(parseFloat(koursExtraGuestPrice)) && parseFloat(koursExtraGuestPrice) > 0 && (
                    <p className="text-[11px] text-[#828294] mt-2">
                      Par élève sup. : {parseFloat(koursExtraGuestPrice).toFixed(2).replace('.', ',')} € brut → {(parseFloat(koursExtraGuestPrice) * (1 - commissionKours / 100)).toFixed(2).replace('.', ',')} € nets
                    </p>
                  )}
                </div>
              )}

              {/* Duration */}
              <div className="mb-5">
                <label className={labelClass}>Durée (minutes)</label>
                <input
                  type="number"
                  min="0"
                  value={koursDuration}
                  onChange={(e) => setKoursDuration(e.target.value)}
                  placeholder="120"
                  className={inputClass}
                />
              </div>

              {/* Max participants */}
              <div className="mb-5">
                <label className={labelClass}>Nombre maximum de participants</label>
                <input
                  type="number"
                  min="1"
                  value={koursMaxParticipants}
                  onChange={(e) => setKoursMaxParticipants(e.target.value)}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val > 0 && ingredientsList.length > 0) scaleIngredients(val);
                  }}
                  placeholder="8"
                  className={inputClass}
                />
              </div>

              {/* Difficulty */}
              <div className="mb-5">
                <label className={labelClass}>Difficulté</label>
                <select
                  value={koursDifficulty}
                  onChange={(e) => setKoursDifficulty(e.target.value)}
                  className={inputClass + ' appearance-none cursor-pointer'}
                >
                  <option value="Débutant">Débutant</option>
                  <option value="Intermédiaire">Intermédiaire</option>
                  <option value="Avancé">Avancé</option>
                </select>
              </div>

            </div>
          )}

          {/* ── KOOK Form ── */}
          {serviceTypes.includes('KOOK') && (
            <div className={`bg-white rounded-[16px] p-6 md:p-8 shadow-sm mb-8 ${isKookDisabled ? 'opacity-60 pointer-events-none' : ''}`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-[12px] bg-[#f3ecff] flex items-center justify-center">
                  <CookingPot size={20} className="text-[#c1a0fd]" />
                </div>
                <div>
                  <h3 className="text-[24px] font-semibold text-[#111125] tracking-[-0.48px]">Service KOOK - Préparation de repas</h3>
                  <p className="text-[13px] text-[#111125]/50">Configurez les détails de votre prestation</p>
                </div>
              </div>

              {/* Orange info box when disabled */}
              {isKookDisabled && (
                <div className="bg-orange-50 border border-orange-200 rounded-[12px] p-4 mb-6 flex items-center gap-3">
                  <Lock size={18} className="text-orange-500 flex-shrink-0" />
                  <p className="text-[13px] text-orange-700 font-medium">
                    Complétez d'abord le formulaire COURS ci-dessus pour débloquer cette section.
                  </p>
                </div>
              )}

              {/* Title */}
              <div className="mb-5">
                <label className={labelClass}>Titre du service</label>
                <input
                  type="text"
                  value={kookTitle}
                  onChange={(e) => setKookTitle(e.target.value)}
                  placeholder="ex: Menu méditerranéen complet"
                  className={inputClass}
                />
              </div>

              {/* Description */}
              <div className="mb-5">
                <label className={labelClass}>Description</label>
                <textarea
                  value={kookDescription}
                  onChange={(e) => setKookDescription(e.target.value)}
                  placeholder="Décrivez votre prestation, le menu proposé, les produits utilisés..."
                  rows={5}
                  className={textareaClass}
                />
              </div>

              {/* Forfait prix info */}
              <div className="bg-[#f3ecff] rounded-[12px] px-4 py-3 mb-5 flex items-start gap-2">
                <span className="text-[16px] shrink-0 mt-0.5">💡</span>
                <p className="text-[13px] text-[#5c5c6f]">
                  Le KOOK fonctionne avec un <strong>forfait de base pour {kookBaseGuests} personnes</strong>. Si le client vient à moins, il paie quand même le forfait. Vous pouvez ajouter un prix par convive supplémentaire.
                </p>
              </div>

              {/* Prix forfait + Extra */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                <div>
                  <label className={labelClass}>Prix forfait {kookBaseGuests} personnes (EUR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={kookPrice}
                    onChange={(e) => setKookPrice(e.target.value)}
                    placeholder="100.00"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Prix par convive supplémentaire (EUR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={kookExtraGuestPrice}
                    onChange={(e) => setKookExtraGuestPrice(e.target.value)}
                    placeholder="15.00"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Durée + Max convives */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                <div>
                  <label className={labelClass}>Durée (minutes)</label>
                  <input
                    type="number"
                    min="0"
                    value={kookDuration}
                    onChange={(e) => setKookDuration(e.target.value)}
                    placeholder="180"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Max convives</label>
                  <input
                    type="number"
                    min="1"
                    value={kookMaxParticipants}
                    onChange={(e) => setKookMaxParticipants(e.target.value)}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val > 0 && ingredientsList.length > 0) scaleIngredients(val);
                    }}
                    placeholder="12"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Simulation de revenus KOOK */}
              {kookPrice && !isNaN(parseFloat(kookPrice)) && parseFloat(kookPrice) > 0 && (
                <div className="bg-[#f2f4fc] border border-[#e0e2ef] rounded-[12px] p-4 mt-2">
                  <p className="text-[12px] font-semibold text-[#303044]/60 mb-3 uppercase tracking-wide flex items-center gap-1.5">
                    Simulation de revenus — commission Weekook {commissionKook}%
                    <span
                      title={tooltipCommission}
                      className="text-[#828294] cursor-help normal-case"
                    >ⓘ</span>
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[13px] text-[#303044]">
                      <span>Forfait {kookBaseGuests} pers. (brut)</span>
                      <span>{parseFloat(kookPrice).toFixed(2).replace('.', ',')} €</span>
                    </div>
                    <div className="flex justify-between text-[13px] text-[#303044]">
                      <span>Commission Weekook ({commissionKook}%)</span>
                      <span className="text-red-500">− {(parseFloat(kookPrice) * commissionKook / 100).toFixed(2).replace('.', ',')} €</span>
                    </div>
                    <div className="flex justify-between text-[13px] font-semibold border-t border-[#e0e2ef] pt-2">
                      <span>Vous recevez</span>
                      <span className="text-[#c1a0fd]">{(parseFloat(kookPrice) * (1 - commissionKook / 100)).toFixed(2).replace('.', ',')} €</span>
                    </div>
                    {kookExtraGuestPrice && !isNaN(parseFloat(kookExtraGuestPrice)) && parseFloat(kookExtraGuestPrice) > 0 && (
                      <p className="text-[12px] text-[#303044]/50 pt-1">
                        Par convive supp. : {parseFloat(kookExtraGuestPrice).toFixed(2).replace('.', ',')} € brut → {(parseFloat(kookExtraGuestPrice) * (1 - commissionKook / 100)).toFixed(2).replace('.', ',')} € nets
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Informations communes ── */}
          {serviceTypes.length > 0 && (
            <div className="bg-white rounded-[20px] p-6 md:p-8 shadow-sm mb-8">
              <h3 className="text-[22px] font-bold text-[#111125] tracking-[-0.44px] mb-6">
                Général
              </h3>

              {/* Photos */}
              <p className="text-[14px] font-bold text-[#303044] mb-3">Photos</p>
              <div className="flex flex-wrap gap-3 mb-2">
                {photos.map((photo, idx) => (
                  <div key={idx} className="relative w-[160px] h-[160px] rounded-[12px] overflow-hidden group shrink-0">
                    <img src={photo} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/50 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}

                {isUploadingPhoto && (
                  <div className="w-[160px] h-[160px] border-2 border-[#c1a0fd]/40 bg-[#f3ecff] rounded-[12px] flex flex-col items-center justify-center shrink-0">
                    <Loader2 size={24} className="text-[#c1a0fd] animate-spin mb-2" />
                    <span className="text-[12px] text-[#c1a0fd] font-medium">Envoi en cours...</span>
                  </div>
                )}

                {photos.length < 8 && !isUploadingPhoto && (
                  <label className="w-[160px] h-[160px] border-2 border-dashed border-[#e0e2ef] hover:border-[#c1a0fd] rounded-[12px] flex flex-col items-center justify-center cursor-pointer transition-colors group shrink-0">
                    <Upload size={24} className="text-[#303044]/30 group-hover:text-[#c1a0fd] transition-colors mb-2" />
                    <span className="text-[13px] text-[#303044]/40 group-hover:text-[#c1a0fd] font-medium transition-colors">Ajouter</span>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                )}
              </div>
              <p className="text-[13px] text-[#303044]/40 mb-6">Ajoutez jusqu'à 8 photos de votre service</p>

              <div className="border-t border-[#f0f0f5] mb-6" />

              {/* Ingrédients */}
              <p className="text-[14px] font-bold text-[#303044] mb-1">Ingrédients</p>
              <p className="text-[12px] text-[#828294] mb-3">Fournis par le client — pour des raisons de sécurité alimentaire</p>

              {/* Sélecteur nombre de personnes de référence */}
              <div className="bg-[#f3ecff] border border-[#c1a0fd]/30 rounded-[12px] px-4 py-3 mb-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-[13px] font-semibold text-[#303044]">Pour combien de personnes ?</p>
                  <p className="text-[12px] text-[#828294] mt-0.5">Les quantités seront ajustées proportionnellement</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => { if (ingredientsBaseServings > 1) scaleIngredients(ingredientsBaseServings - 1); }}
                    disabled={ingredientsBaseServings <= 1}
                    className="w-[32px] h-[32px] flex items-center justify-center bg-white border border-[#c1a0fd]/40 text-[#c1a0fd] rounded-[8px] text-[18px] font-bold leading-none hover:bg-[#c1a0fd] hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >−</button>
                  <span className="w-[40px] text-center text-[16px] font-bold text-[#111125]">{ingredientsBaseServings}</span>
                  <button
                    type="button"
                    onClick={() => scaleIngredients(ingredientsBaseServings + 1)}
                    className="w-[32px] h-[32px] flex items-center justify-center bg-white border border-[#c1a0fd]/40 text-[#c1a0fd] rounded-[8px] text-[18px] font-bold leading-none hover:bg-[#c1a0fd] hover:text-white transition-all cursor-pointer"
                  >+</button>
                </div>
              </div>
              {ingredientsList.length > 0 && (
                <div className="space-y-2 mb-3">
                  {ingredientsList.map((ing, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3 bg-[#f3ecff] rounded-[12px] px-4 py-2.5">
                      <span className="text-[13px] font-semibold text-[#111125] flex-1 min-w-0 truncate">{ing.name}</span>
                      <span className="text-[13px] text-[#c1a0fd] shrink-0">{ing.quantity} {ing.unit}</span>
                      <button type="button" onClick={() => setIngredientsList((prev) => prev.filter((_, i) => i !== idx))} className="shrink-0 w-6 h-6 flex items-center justify-center text-[#303044]/30 hover:text-red-500 transition-colors cursor-pointer">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-2 border-dashed border-[#e0e2ef] rounded-[16px] p-4 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px_120px_48px] gap-2">
                  <input type="text" value={newIngName} onChange={(e) => setNewIngName(e.target.value)} placeholder="Nom (ex: Farine)" className={inputClass} />
                  <input type="text" value={newIngQty} onChange={(e) => setNewIngQty(e.target.value)} placeholder="Qté" className={inputClass} />
                  <div className="relative">
                    <select value={newIngUnit} onChange={(e) => setNewIngUnit(e.target.value)} className={inputClass + ' appearance-none cursor-pointer pr-8'}>
                      {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 6L8 10L12 6" stroke="#303044" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  </div>
                  <button type="button" onClick={() => { const name = newIngName.trim(); const qty = newIngQty.trim(); if (!name || !qty) return; setIngredientsList((prev) => [...prev, { name, quantity: qty, unit: newIngUnit }]); setNewIngName(''); setNewIngQty(''); setNewIngUnit('g'); }} disabled={!newIngName.trim() || !newIngQty.trim()} className="w-full sm:w-[48px] h-[48px] flex items-center justify-center bg-[#c1a0fd] hover:bg-[#b090ed] text-white rounded-[12px] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                    <Plus size={20} />
                  </button>
                </div>
              </div>

              <div className="border-t border-[#f0f0f5] mb-6" />

              {/* Matériel kooker */}
              <p className="text-[14px] font-bold text-[#303044] mb-1">Matériel fourni par le kooker</p>
              <p className="text-[12px] text-[#828294] mb-3">Ustensiles et équipements que vous apportez</p>
              {equipmentKooker.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {equipmentKooker.map((item) => (
                    <span key={item} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#f3ecff] text-[#c1a0fd] text-[13px] font-semibold rounded-[8px]">
                      {item}
                      <button type="button" onClick={() => setEquipmentKooker((prev) => prev.filter((x) => x !== item))} className="hover:text-red-500 transition-colors cursor-pointer"><X size={12} /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mb-6">
                <input type="text" value={newEquipmentKooker} onChange={(e) => setNewEquipmentKooker(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const val = newEquipmentKooker.trim(); if (val && !equipmentKooker.includes(val)) { setEquipmentKooker((prev) => [...prev, val]); setNewEquipmentKooker(''); } } }} placeholder="Ex: Couteau de chef, balance..." className={inputClass + ' flex-1'} />
                <button type="button" onClick={() => { const val = newEquipmentKooker.trim(); if (val && !equipmentKooker.includes(val)) { setEquipmentKooker((prev) => [...prev, val]); setNewEquipmentKooker(''); } }} disabled={!newEquipmentKooker.trim()} className="w-[48px] h-[48px] flex items-center justify-center bg-[#c1a0fd] hover:bg-[#b090ed] text-white rounded-[12px] transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"><Plus size={20} /></button>
              </div>

              {/* Matériel client */}
              <p className="text-[14px] font-bold text-[#303044] mb-1">Matériel à fournir par le client</p>
              <p className="text-[12px] text-[#828294] mb-3">Ustensiles et équipements que le client doit avoir</p>
              {equipmentClient.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {equipmentClient.map((item) => (
                    <span key={item} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#f2f4fc] text-[#303044] text-[13px] font-semibold rounded-[8px]">
                      {item}
                      <button type="button" onClick={() => setEquipmentClient((prev) => prev.filter((x) => x !== item))} className="hover:text-red-500 transition-colors cursor-pointer"><X size={12} /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mb-6">
                <input type="text" value={newEquipmentClient} onChange={(e) => setNewEquipmentClient(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const val = newEquipmentClient.trim(); if (val && !equipmentClient.includes(val)) { setEquipmentClient((prev) => [...prev, val]); setNewEquipmentClient(''); } } }} placeholder="Ex: Saladier, fouet, planche..." className={inputClass + ' flex-1'} />
                <button type="button" onClick={() => { const val = newEquipmentClient.trim(); if (val && !equipmentClient.includes(val)) { setEquipmentClient((prev) => [...prev, val]); setNewEquipmentClient(''); } }} disabled={!newEquipmentClient.trim()} className="w-[48px] h-[48px] flex items-center justify-center bg-[#c1a0fd] hover:bg-[#b090ed] text-white rounded-[12px] transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"><Plus size={20} /></button>
              </div>

              <div className="border-t border-[#f0f0f5] mb-6" />

              {/* Spécialités */}
              <p className="text-[14px] font-bold text-[#303044] mb-3">Spécialités</p>
              {availableSpecialties.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-6">
                  {availableSpecialties.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSpecialties((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])}
                      className={`px-3 py-1.5 text-[13px] font-semibold rounded-[8px] transition-all cursor-pointer border ${
                        specialties.includes(s)
                          ? 'bg-[#c1a0fd] border-[#c1a0fd] text-white'
                          : 'bg-white border-[#e0e2ef] text-[#303044] hover:border-[#c1a0fd] hover:text-[#c1a0fd]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-[#828294] mb-6">Aucune spécialité configurée — ajoutez-en depuis la page Admin.</p>
              )}

              <div className="border-t border-[#f0f0f5] mb-6" />

              {/* Allergènes */}
              <p className="text-[14px] font-bold text-[#303044] mb-4">Allergènes présents</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 mb-4">
                {ALL_ALLERGENS.map((a) => (
                  <label key={a} className="flex items-center gap-2.5 cursor-pointer" onClick={() => toggleAllergen(a)}>
                    <div className={`w-4 h-4 rounded-[3px] border-2 flex items-center justify-center shrink-0 transition-all ${allergens.includes(a) ? 'bg-[#c1a0fd] border-[#c1a0fd]' : 'bg-white border-[#c0c0cc]'}`}>
                      {allergens.includes(a) && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3L3.5 5.5L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span className="text-[14px] text-[#303044]">{a}</span>
                    {a === 'Fruits de mer' && (
                      <span title={tooltipFruitsDesMer} className="text-[#828294] cursor-help text-[12px] leading-none">ⓘ</span>
                    )}
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-[#828294] leading-relaxed mb-6">
                ⚠️ La gestion des allergènes relève de la responsabilité du client. Le kooker s'engage à indiquer les informations dont il dispose, mais ne peut être tenu responsable en cas de réaction allergique.
              </p>

              <div className="border-t border-[#f0f0f5] mb-5" />

              {/* Régimes */}
              <p className="text-[14px] font-bold text-[#303044] mb-4">Régimes alimentaires</p>
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2.5 cursor-pointer" onClick={() => setIsVegetarian(!isVegetarian)}>
                  <div className={`w-4 h-4 rounded-[3px] border-2 flex items-center justify-center shrink-0 transition-all ${isVegetarian ? 'bg-[#c1a0fd] border-[#c1a0fd]' : 'bg-white border-[#c0c0cc]'}`}>
                    {isVegetarian && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3L3.5 5.5L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span className="text-[14px] text-[#303044]">Végétarien</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer" onClick={() => setIsPorkFree(!isPorkFree)}>
                  <div className={`w-4 h-4 rounded-[3px] border-2 flex items-center justify-center shrink-0 transition-all ${isPorkFree ? 'bg-[#c1a0fd] border-[#c1a0fd]' : 'bg-white border-[#c0c0cc]'}`}>
                    {isPorkFree && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3L3.5 5.5L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span className="text-[14px] text-[#303044]">Sans porc</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* ── Sticky Action Bar ── */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e0e2ef] z-50">
          <div className="max-w-[1000px] mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => navigate('/kooker-dashboard')}
              className="px-6 py-3 text-[14px] font-medium text-[#111125]/50 hover:text-[#111125] bg-white border border-[#e0e2ef] hover:border-[#111125]/20 rounded-[12px] transition-all"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!canSubmit || (serviceTypes.includes('COURS') && serviceTypes.includes('KOOK') && !isKoursComplete)}
              className="px-8 py-3 text-[14px] font-semibold text-white bg-[#c1a0fd] hover:bg-[#b090ed] rounded-[12px] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer les modifications'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
