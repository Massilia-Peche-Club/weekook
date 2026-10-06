import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ChefHat, MapPin, Clock, Plus, X, Users } from 'lucide-react';
import { usePageTiming } from '@/hooks/usePageTiming';

export default function BecomeKookerPage() {
  usePageTiming('Devenir Kooker', true);
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    phone: '',
    address: '',
    city: '',
    description: '',
    specialties: [] as string[],
    experience: 0,
    maxCapacity: 1,
    availability: '',
    isCompany: false,
  });

  const [newSpecialty, setNewSpecialty] = useState('');

  useEffect(() => {
    document.title = 'Devenir Kooker - Weekook';
    // Redirect if already a kooker (BUG-026)
    if (user?.kookerProfileId) {
      navigate('/kooker-dashboard', { replace: true });
    }
  }, [user, navigate]);

  const addSpecialty = () => {
    const trimmed = newSpecialty.trim();
    if (trimmed && !formData.specialties.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        specialties: [...prev.specialties, trimmed],
      }));
      setNewSpecialty('');
    }
  };

  const removeSpecialty = (specialty: string) => {
    setFormData((prev) => ({
      ...prev,
      specialties: prev.specialties.filter((s) => s !== specialty),
    }));
  };

  const handleSpecialtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSpecialty();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/kookers/become', {
        bio: formData.description,
        specialties: formData.specialties,
        type: ['KOOK', 'COURS'],
        city: formData.city,
        experience: formData.experience + ' ans',
        isCompany: formData.isCompany,
      });
      toast.success('Votre profil Kooker a été créé ! Il sera visible après validation.');
      await refreshUser();
      navigate('/kooker-dashboard');
    } catch (err) {
      toast.error('Erreur lors de la création du profil kooker');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f4fc]">
      <div className="py-10 md:py-16 px-4 md:px-8 lg:px-[96px]">
        <div className="max-w-[900px] mx-auto">
          {/* ── Header ─────────────────────────────────────────────── */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-[#c1a0fd] w-[64px] h-[64px] rounded-full flex items-center justify-center">
                <ChefHat className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-[40px] text-[#111125] tracking-[-0.8px] leading-[1.15]">
                  Devenir Kooker
                </h1>
                <p className="text-[16px] text-[#5c5c6f]">
                  Partagez votre passion culinaire et gagnez de l'argent en proposant vos services
                </p>
              </div>
            </div>
          </div>

          {/* ── Form Card ──────────────────────────────────────────── */}
          <form onSubmit={handleSubmit}>
            <div className="bg-white rounded-[20px] p-6 md:p-8 shadow-sm mb-6">
              {/* ── Section: Contact ──────────────────────────────── */}
              <div className="mb-8">
                <div className="flex items-center gap-2.5 mb-5">
                  <MapPin className="w-5 h-5 text-[#c1a0fd]" />
                  <h2 className="text-[24px] font-semibold text-[#111125]">
                    Informations de contact
                  </h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-[14px] font-semibold text-[#111125] mb-2">
                      Téléphone
                    </Label>
                    <Input
                      type="tel"
                      placeholder="06 12 34 56 78"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      required
                      className="h-[48px] bg-white border-[#e0e2ef] rounded-[12px] text-[14px] text-[#111125] placeholder:text-[#111125]/30 focus-visible:border-[#c1a0fd] focus-visible:ring-[#c1a0fd]/20"
                    />
                  </div>

                  <div>
                    <Label className="text-[14px] font-semibold text-[#111125] mb-2">
                      Adresse
                    </Label>
                    <Input
                      type="text"
                      placeholder="12 rue de la République"
                      value={formData.address}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, address: e.target.value }))
                      }
                      required
                      className="h-[48px] bg-white border-[#e0e2ef] rounded-[12px] text-[14px] text-[#111125] placeholder:text-[#111125]/30 focus-visible:border-[#c1a0fd] focus-visible:ring-[#c1a0fd]/20"
                    />
                  </div>

                  <div>
                    <Label className="text-[14px] font-semibold text-[#111125] mb-2">
                      Ville
                    </Label>
                    <Input
                      type="text"
                      placeholder="Marseille"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, city: e.target.value }))
                      }
                      required
                      className="h-[48px] bg-white border-[#e0e2ef] rounded-[12px] text-[14px] text-[#111125] placeholder:text-[#111125]/30 focus-visible:border-[#c1a0fd] focus-visible:ring-[#c1a0fd]/20"
                    />
                  </div>

                  <div>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isCompany}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, isCompany: e.target.checked }))
                        }
                        className="mt-0.5 w-5 h-5 rounded-[4px] border-[#e0e2ef] text-[#c1a0fd] focus:ring-[#c1a0fd]/20 cursor-pointer accent-[#c1a0fd]"
                      />
                      <div>
                        <span className="text-[14px] font-semibold text-[#111125]">
                          J'exerce en tant que société
                        </span>
                        <p className="text-[12px] text-[#828294] mt-0.5">
                          Cochez si vous exercez sous forme de société (SARL, SAS, auto-entrepreneur avec SIRET...)
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* ── Separator ────────────────────────────────────── */}
              <div className="border-t border-[#e0e2ef] mb-8" />

              {/* ── Section: Culinary Profile ─────────────────────── */}
              <div className="mb-8">
                <div className="flex items-center gap-2.5 mb-5">
                  <ChefHat className="w-5 h-5 text-[#c1a0fd]" />
                  <h2 className="text-[24px] font-semibold text-[#111125]">
                    Profil culinaire
                  </h2>
                </div>

                <div className="space-y-4">
                  {/* Bio */}
                  <div>
                    <Label className="text-[14px] font-semibold text-[#111125] mb-2">
                      Bio / Description
                    </Label>
                    <Textarea
                      placeholder="Parlez de vous, de votre parcours culinaire, de ce qui vous passionne en cuisine..."
                      rows={6}
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      required
                      className="bg-white border-[#e0e2ef] rounded-[12px] text-[14px] text-[#111125] placeholder:text-[#111125]/30 focus-visible:border-[#c1a0fd] focus-visible:ring-[#c1a0fd]/20"
                    />
                    <p className="text-[12px] text-[#828294] mt-1.5">
                      Cette description sera visible sur votre profil public.
                    </p>
                  </div>

                  {/* Specialties */}
                  <div>
                    <Label className="text-[14px] font-semibold text-[#111125] mb-2">
                      Spécialités
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="Ex : Cuisine provençale"
                        value={newSpecialty}
                        onChange={(e) => setNewSpecialty(e.target.value)}
                        onKeyDown={handleSpecialtyKeyDown}
                        className="h-[48px] flex-1 bg-white border-[#e0e2ef] rounded-[12px] text-[14px] text-[#111125] placeholder:text-[#111125]/30 focus-visible:border-[#c1a0fd] focus-visible:ring-[#c1a0fd]/20"
                      />
                      <button
                        type="button"
                        onClick={addSpecialty}
                        className="h-[48px] w-[48px] flex-shrink-0 flex items-center justify-center bg-[#c1a0fd] hover:bg-[#b090ed] text-[#111125] rounded-[8px] transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>

                    {formData.specialties.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {formData.specialties.map((specialty) => (
                          <span
                            key={specialty}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[rgba(218,198,254,0.48)] text-violet-600 text-[14px] rounded-[12px]"
                          >
                            {specialty}
                            <button
                              type="button"
                              onClick={() => removeSpecialty(specialty)}
                              className="hover:text-[#111125] transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Experience */}
                  <div>
                    <Label className="text-[14px] font-semibold text-[#111125] mb-2">
                      Années d'expérience
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      placeholder="5"
                      value={formData.experience || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          experience: parseInt(e.target.value) || 0,
                        }))
                      }
                      required
                      className="h-[48px] bg-white border-[#e0e2ef] rounded-[12px] text-[14px] text-[#111125] placeholder:text-[#111125]/30 focus-visible:border-[#c1a0fd] focus-visible:ring-[#c1a0fd]/20 max-w-[200px]"
                    />
                  </div>
                </div>
              </div>

              {/* ── Separator ────────────────────────────────────── */}
              <div className="border-t border-[#e0e2ef] mb-8" />

              {/* ── Section: Capacity & Availability ──────────────── */}
              <div>
                <div className="flex items-center gap-2.5 mb-5">
                  <Clock className="w-5 h-5 text-[#c1a0fd]" />
                  <h2 className="text-[24px] font-semibold text-[#111125]">
                    Capacité et disponibilités
                  </h2>
                </div>

                <div className="space-y-4">
                  {/* Max capacity */}
                  <div>
                    <Label className="text-[14px] font-semibold text-[#111125] mb-2">
                      Capacité maximale (nombre de convives)
                    </Label>
                    <div className="relative max-w-[200px]">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#111125]/40" />
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        placeholder="8"
                        value={formData.maxCapacity || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            maxCapacity: parseInt(e.target.value) || 1,
                          }))
                        }
                        required
                        className="h-[48px] pl-10 bg-white border-[#e0e2ef] rounded-[12px] text-[14px] text-[#111125] placeholder:text-[#111125]/30 focus-visible:border-[#c1a0fd] focus-visible:ring-[#c1a0fd]/20"
                      />
                    </div>
                  </div>

                  {/* Availability */}
                  <div>
                    <Label className="text-[14px] font-semibold text-[#111125] mb-2">
                      Disponibilités générales
                    </Label>
                    <Input
                      type="text"
                      placeholder="Ex : Weekends et mercredis soir"
                      value={formData.availability}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          availability: e.target.value,
                        }))
                      }
                      className="h-[48px] bg-white border-[#e0e2ef] rounded-[12px] text-[14px] text-[#111125] placeholder:text-[#111125]/30 focus-visible:border-[#c1a0fd] focus-visible:ring-[#c1a0fd]/20"
                    />
                    <p className="text-[12px] text-[#828294] mt-1.5">
                      Vous pourrez configurer un planning détaillé depuis votre tableau de bord Kooker.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Info Box ────────────────────────────────────────── */}
            <div className="bg-[#f3ecff] border-2 border-[#c1a0fd] rounded-[12px] p-6 md:p-8 mb-8">
              <h3 className="text-[15px] font-semibold text-[#111125] mb-3">
                Prochaines étapes
              </h3>
              <ul className="space-y-2 text-[13px] text-[#5c5c6f]">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[#c1a0fd] flex-shrink-0" />
                  Votre profil Kooker sera immédiatement visible sur la plateforme
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[#c1a0fd] flex-shrink-0" />
                  Vous pourrez créer vos offres de repas et de cours depuis votre tableau de bord
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[#c1a0fd] flex-shrink-0" />
                  Gérez vos disponibilités et recevez des réservations directement
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[#c1a0fd] flex-shrink-0" />
                  Communiquez avec vos clients via la messagerie intégrée
                </li>
              </ul>
            </div>

            {/* ── Action Buttons ──────────────────────────────────── */}
            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="h-[48px] px-6 border-2 border-[#e0e0e6] text-[#303044] font-medium text-[16px] tracking-[-0.32px] rounded-[8px] hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-[48px] px-8 bg-[#c1a0fd] hover:bg-[#b090ed] text-[#111125] font-medium text-[16px] tracking-[-0.32px] rounded-[8px] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 flex-1"
              >
                {isSubmitting ? (
                  <svg
                    className="animate-spin h-5 w-5 text-[#111125]"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <>
                    <ChefHat className="w-5 h-5" />
                    Je deviens Kooker !
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
