import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { toast } from 'sonner';

// ─────────────────────────── Types ───────────────────────────

interface HostingProfile {
  address: string;
  addressComplement: string;
  city: string;
  postalCode: string;
  country: string;
  accessCode: string;
  floor: string;
  intercom: string;
  parkingInfo: string;
  stoveType: string;
  hasOven: boolean;
  hasDishwasher: boolean;
  tableCapacity: string;
  kitchenNotes: string;
  dietaryRestrictions: string[];
  allergies: string[];
  hostingNotes: string;
}

// ─────────────────────────── Constants ───────────────────────────

const DIETARY_OPTIONS = [
  'Végétarien', 'Végétalien / Vegan', 'Sans gluten', 'Halal',
  'Casher', 'Sans lactose', 'Sans porc', 'Sans alcool dans les préparations',
];

const ALLERGEN_OPTIONS = [
  'Gluten', 'Crustacés', 'Œufs', 'Poisson', 'Arachides',
  'Soja', 'Lait', 'Fruits à coque', 'Céleri', 'Moutarde',
  'Sésame', 'Sulfites', 'Lupin', 'Mollusques',
];

const EMPTY_PROFILE: HostingProfile = {
  address: '', addressComplement: '', city: '', postalCode: '', country: 'France',
  accessCode: '', floor: '', intercom: '', parkingInfo: '',
  stoveType: '', hasOven: false, hasDishwasher: false, tableCapacity: '', kitchenNotes: '',
  dietaryRestrictions: [], allergies: [],
  hostingNotes: '',
};

type SectionKey = 'personal' | 'address' | 'access' | 'kitchen' | 'dietary' | 'notes';

const SECTIONS: { key: SectionKey; label: string; shortLabel: string; icon: React.ReactNode }[] = [
  {
    key: 'personal', label: 'Informations personnelles', shortLabel: 'Infos',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="5.33337" r="2.66667" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M2.66667 13.3334C2.66667 11.1242 4.45753 9.33337 6.66667 9.33337H9.33333C11.5425 9.33337 13.3333 11.1242 13.3333 13.3334" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    key: 'address', label: 'Adresse de prestation', shortLabel: 'Adresse',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 1.33337C5.42267 1.33337 3.33333 3.42271 3.33333 6.00004C3.33333 9.33337 8 14.6667 8 14.6667C8 14.6667 12.6667 9.33337 12.6667 6.00004C12.6667 3.42271 10.5773 1.33337 8 1.33337Z" stroke="currentColor" strokeWidth="1.2"/>
        <circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    ),
  },
  {
    key: 'access', label: 'Accès & logistique', shortLabel: 'Accès',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="6" cy="6.66663" r="3.33333" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M8.66667 9.33337L14 14.6667" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M11.3333 12L12.6667 10.6667" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    key: 'kitchen', label: 'Cuisine & équipement', shortLabel: 'Cuisine',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2.66667 2.66663V7.33329C2.66667 8.80605 3.86057 9.99996 5.33333 9.99996H5.66667C7.13943 9.99996 8.33333 8.80605 8.33333 7.33329V2.66663" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M5.5 10V13.3333" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M3.66667 13.3334H7.33333" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M12 2.66663C12 2.66663 13.3333 4.66663 13.3333 7.33329C13.3333 8.80605 12.4697 9.99996 12 9.99996V13.3333" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    key: 'dietary', label: 'Régimes & allergènes', shortLabel: 'Régimes',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 1.33337C8 1.33337 3.33333 4.00004 3.33333 8.00004C3.33333 10.5774 5.42267 12.6667 8 12.6667C10.5773 12.6667 12.6667 10.5774 12.6667 8.00004C12.6667 4.00004 8 1.33337 8 1.33337Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
        <path d="M8 5.33337V9.33337" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M6 7.33337H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    key: 'notes', label: 'Notes pour le kooker', shortLabel: 'Notes',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2.66667" y="2" width="10.6667" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M5.33333 5.33337H10.6667" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M5.33333 8H10.6667" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M5.33333 10.6666H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
];

// ─────────────────────────── Sub-components ───────────────────────────

const inputCls = 'w-full h-[44px] px-4 border border-[#e0e2ef] rounded-[12px] text-[14px] text-[#111125] focus:outline-none focus:border-[#c1a0fd] bg-white placeholder:text-[#c0c2d0]';
const textareaCls = 'w-full px-4 py-3 border border-[#e0e2ef] rounded-[12px] text-[14px] text-[#111125] focus:outline-none focus:border-[#c1a0fd] bg-white placeholder:text-[#c0c2d0] resize-none';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-[#111125] mb-1">{label}</label>
      {hint && <p className="text-[12px] text-[#828294] mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

function CheckTag({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`px-3 py-2 rounded-[10px] text-[13px] font-medium border transition-all ${
        checked
          ? 'bg-[#c1a0fd] border-[#c1a0fd] text-white'
          : 'bg-white border-[#e0e2ef] text-[#5c5c6f] hover:border-[#c1a0fd]'
      }`}
    >
      {checked ? '✓ ' : ''}{label}
    </button>
  );
}

function SaveButton({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <div className="mt-8 pt-6 border-t border-[#e0e2ef] flex justify-end">
      <button
        onClick={onClick}
        disabled={saving}
        className="px-8 h-[44px] bg-[#c1a0fd] hover:bg-[#b090ed] text-[#111125] text-[14px] font-semibold rounded-[12px] transition-all disabled:opacity-50"
      >
        {saving ? 'Enregistrement...' : 'Enregistrer'}
      </button>
    </div>
  );
}

// ─────────────────────────── Page ───────────────────────────

const UserProfilePage = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  const [activeSection, setActiveSection] = useState<SectionKey>('personal');
  const [personal, setPersonal] = useState({ firstName: '', lastName: '', phone: '', email: '' });
  const [hosting, setHosting] = useState<HostingProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);

  const [savingPersonal, setSavingPersonal] = useState(false);
  const [savingAddress,  setSavingAddress]  = useState(false);
  const [savingAccess,   setSavingAccess]   = useState(false);
  const [savingKitchen,  setSavingKitchen]  = useState(false);
  const [savingDietary,  setSavingDietary]  = useState(false);
  const [savingNotes,    setSavingNotes]    = useState(false);

  useEffect(() => {
    document.title = 'Mon profil - Weekook';
    const load = async () => {
      if (user) {
        setPersonal({ firstName: user.firstName, lastName: user.lastName, phone: user.phone ?? '', email: user.email ?? '' });
      }
      try {
        const res = await api.get<HostingProfile & { tableCapacity: number | null }>('/users/hosting-profile');
        if (res.success && res.data) {
          setHosting({
            ...EMPTY_PROFILE,
            ...res.data,
            tableCapacity: res.data.tableCapacity != null ? String(res.data.tableCapacity) : '',
            dietaryRestrictions: (res.data.dietaryRestrictions as string[]) ?? [],
            allergies: (res.data.allergies as string[]) ?? [],
          });
        }
      } catch { /* profil vide */ }
      setLoading(false);
    };
    load();
  }, [user]);

  const savePersonal = async () => {
    setSavingPersonal(true);
    try {
      const payload: Record<string, string> = {
        firstName: personal.firstName,
        lastName: personal.lastName,
        phone: personal.phone,
      };
      if (personal.email !== (user?.email ?? '')) payload.email = personal.email;
      const res = await api.put<{ pendingEmailChange?: boolean }>('/users/profile', payload);
      await refreshUser();
      if (res.data?.pendingEmailChange) {
        toast.success('Un lien de confirmation a été envoyé à votre nouvelle adresse email.');
      } else {
        toast.success('Informations mises à jour');
      }
    } catch { toast.error('Erreur lors de la mise à jour'); }
    finally { setSavingPersonal(false); }
  };

  const saveHosting = async (fields: Record<string, unknown>, setSaving: (v: boolean) => void) => {
    setSaving(true);
    try {
      await api.put('/users/hosting-profile', fields);
      toast.success('Enregistré');
    } catch { toast.error('Erreur lors de la mise à jour'); }
    finally { setSaving(false); }
  };

  const toggleMulti = (key: 'dietaryRestrictions' | 'allergies', value: string) => {
    setHosting(h => {
      const arr = h[key];
      return { ...h, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f2f4fc] flex items-center justify-center">
        <svg className="animate-spin h-10 w-10 text-[#c1a0fd]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  const activeSectionData = SECTIONS.find(s => s.key === activeSection)!;

  return (
    <div className="min-h-screen bg-[#f2f4fc]">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 lg:px-[96px] py-8 md:py-12">

        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <button
              onClick={() => navigate('/tableau-de-bord')}
              className="flex items-center gap-1.5 text-[13px] text-[#828294] hover:text-[#111125] transition-colors mb-3"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 14L6 8L10 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Mon tableau de bord
            </button>
            <h1 className="text-[32px] md:text-[40px] font-semibold text-[#111125] tracking-[-0.8px]">
              Mon profil
            </h1>
            <p className="text-[16px] text-[#5c5c6f] mt-1">
              Toutes les informations utiles pour votre kooker
            </p>
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="lg:hidden grid grid-cols-3 bg-white rounded-[12px] p-2 mb-6 gap-1">
          {SECTIONS.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`py-2.5 rounded-[8px] text-[12px] font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeSection === s.key
                  ? 'bg-[#c1a0fd] text-white shadow-sm'
                  : 'text-[#111125]/50 hover:text-[#111125]'
              }`}
            >
              <span>{s.icon}</span>
              <span>{s.shortLabel}</span>
            </button>
          ))}
        </div>

        {/* Body: sidebar + content */}
        <div className="flex gap-6 items-start">

          {/* Sidebar — desktop only */}
          <aside className="hidden lg:block w-[220px] shrink-0 bg-white rounded-[20px] p-3 shadow-sm sticky top-6">
            <nav className="space-y-1">
              {SECTIONS.map(s => (
                <button
                  key={s.key}
                  onClick={() => setActiveSection(s.key)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-[12px] text-[14px] font-medium transition-all text-left ${
                    activeSection === s.key
                      ? 'bg-[#c1a0fd] text-white shadow-sm'
                      : 'text-[#111125]/60 hover:text-[#111125] hover:bg-[#f2f4fc]'
                  }`}
                >
                  <span className={activeSection === s.key ? 'text-white' : 'text-[#111125]/40'}>
                    {s.icon}
                  </span>
                  {s.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-[20px] p-6 md:p-8 shadow-sm">

              {/* Section title */}
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-[#e0e2ef]">
                <div className="w-9 h-9 rounded-[10px] bg-[#c1a0fd]/10 flex items-center justify-center text-[#c1a0fd]">
                  {activeSectionData.icon}
                </div>
                <h2 className="text-[20px] font-semibold text-[#111125]">{activeSectionData.label}</h2>
              </div>

              {/* ── Personal ── */}
              {activeSection === 'personal' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Prénom">
                      <input type="text" value={personal.firstName}
                        onChange={e => setPersonal(p => ({ ...p, firstName: e.target.value }))}
                        className={inputCls} />
                    </Field>
                    <Field label="Nom">
                      <input type="text" value={personal.lastName}
                        onChange={e => setPersonal(p => ({ ...p, lastName: e.target.value }))}
                        className={inputCls} />
                    </Field>
                  </div>
                  <Field label="Téléphone" hint="Le kooker pourra vous contacter en cas d'imprévu">
                    <input type="tel" value={personal.phone}
                      onChange={e => setPersonal(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+33 6 00 00 00 00"
                      className={inputCls} />
                  </Field>
                  <Field label="Email (identifiant de connexion)">
                    <input type="email" value={personal.email}
                      onChange={e => setPersonal(p => ({ ...p, email: e.target.value }))}
                      className={inputCls} />
                  </Field>
                  {personal.email !== (user?.email ?? '') && (
                    <div className="flex items-start gap-2.5 p-4 bg-[#fff8e1] border border-[#ffe082] rounded-[12px] text-[13px] text-[#7c6000]">
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#f59e0b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                      <span>
                        <strong>Attention :</strong> modifier votre email changera également votre identifiant de connexion. Vous devrez utiliser cette nouvelle adresse pour vous connecter.
                      </span>
                    </div>
                  )}
                  <SaveButton saving={savingPersonal} onClick={savePersonal} />
                </div>
              )}

              {/* ── Address ── */}
              {activeSection === 'address' && (
                <div className="space-y-4">
                  <Field label="Adresse">
                    <input type="text" value={hosting.address}
                      onChange={e => setHosting(h => ({ ...h, address: e.target.value }))}
                      placeholder="12 rue de la Paix"
                      className={inputCls} />
                  </Field>
                  <Field label="Complément d'adresse" hint="Bâtiment, résidence, appartement…">
                    <input type="text" value={hosting.addressComplement}
                      onChange={e => setHosting(h => ({ ...h, addressComplement: e.target.value }))}
                      placeholder="Bât. B, Appt 32"
                      className={inputCls} />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Code postal">
                      <input type="text" value={hosting.postalCode}
                        onChange={e => setHosting(h => ({ ...h, postalCode: e.target.value }))}
                        placeholder="13001" className={inputCls} />
                    </Field>
                    <Field label="Ville">
                      <input type="text" value={hosting.city}
                        onChange={e => setHosting(h => ({ ...h, city: e.target.value }))}
                        placeholder="Marseille" className={inputCls} />
                    </Field>
                  </div>
                  <Field label="Pays">
                    <input type="text" value={hosting.country}
                      onChange={e => setHosting(h => ({ ...h, country: e.target.value }))}
                      className={inputCls} />
                  </Field>
                  <SaveButton saving={savingAddress} onClick={() => saveHosting({
                    address: hosting.address, addressComplement: hosting.addressComplement,
                    city: hosting.city, postalCode: hosting.postalCode, country: hosting.country,
                  }, setSavingAddress)} />
                </div>
              )}

              {/* ── Access ── */}
              {activeSection === 'access' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Code d'accès / digicode" hint="Code pour entrer dans l'immeuble">
                      <input type="text" value={hosting.accessCode}
                        onChange={e => setHosting(h => ({ ...h, accessCode: e.target.value }))}
                        placeholder="A1234#" className={inputCls} />
                    </Field>
                    <Field label="Étage">
                      <input type="text" value={hosting.floor}
                        onChange={e => setHosting(h => ({ ...h, floor: e.target.value }))}
                        placeholder="3ème étage, porte droite" className={inputCls} />
                    </Field>
                  </div>
                  <Field label="Nom sur l'interphone">
                    <input type="text" value={hosting.intercom}
                      onChange={e => setHosting(h => ({ ...h, intercom: e.target.value }))}
                      placeholder="Dupont" className={inputCls} />
                  </Field>
                  <Field label="Informations parking" hint="Où se garer ? Y a-t-il une place réservée ?">
                    <textarea value={hosting.parkingInfo}
                      onChange={e => setHosting(h => ({ ...h, parkingInfo: e.target.value }))}
                      placeholder="Parking souterrain en face, code : 5678. Ou rue libre le matin."
                      rows={3} className={textareaCls} />
                  </Field>
                  <SaveButton saving={savingAccess} onClick={() => saveHosting({
                    accessCode: hosting.accessCode, floor: hosting.floor,
                    intercom: hosting.intercom, parkingInfo: hosting.parkingInfo,
                  }, setSavingAccess)} />
                </div>
              )}

              {/* ── Kitchen ── */}
              {activeSection === 'kitchen' && (
                <div className="space-y-6">
                  <Field label="Type de plaque de cuisson">
                    <div className="flex flex-wrap gap-2 mt-1">
                      {(['gaz', 'induction', 'électrique', 'mixte'] as const).map(type => (
                        <CheckTag key={type}
                          label={type.charAt(0).toUpperCase() + type.slice(1)}
                          checked={hosting.stoveType === type}
                          onChange={() => setHosting(h => ({ ...h, stoveType: h.stoveType === type ? '' : type }))} />
                      ))}
                    </div>
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <Field label="Four disponible">
                      <div className="flex gap-2 mt-1.5">
                        <CheckTag label="Oui" checked={hosting.hasOven} onChange={() => setHosting(h => ({ ...h, hasOven: true }))} />
                        <CheckTag label="Non" checked={!hosting.hasOven} onChange={() => setHosting(h => ({ ...h, hasOven: false }))} />
                      </div>
                    </Field>
                    <Field label="Lave-vaisselle">
                      <div className="flex gap-2 mt-1.5">
                        <CheckTag label="Oui" checked={hosting.hasDishwasher} onChange={() => setHosting(h => ({ ...h, hasDishwasher: true }))} />
                        <CheckTag label="Non" checked={!hosting.hasDishwasher} onChange={() => setHosting(h => ({ ...h, hasDishwasher: false }))} />
                      </div>
                    </Field>
                  </div>
                  <Field label="Nombre de couverts maximum" hint="Combien de personnes peut accueillir votre table ?">
                    <input type="number" min="1" max="100" value={hosting.tableCapacity}
                      onChange={e => setHosting(h => ({ ...h, tableCapacity: e.target.value }))}
                      placeholder="6" className={inputCls + ' max-w-[140px]'} />
                  </Field>
                  <Field label="Notes sur la cuisine" hint="Matériel disponible, particularités…">
                    <textarea value={hosting.kitchenNotes}
                      onChange={e => setHosting(h => ({ ...h, kitchenNotes: e.target.value }))}
                      placeholder="Robot Thermomix disponible. Pas de plancha. Cuisine ouverte sur le salon."
                      rows={4} className={textareaCls} />
                  </Field>
                  <SaveButton saving={savingKitchen} onClick={() => saveHosting({
                    stoveType: hosting.stoveType || undefined,
                    hasOven: hosting.hasOven, hasDishwasher: hosting.hasDishwasher,
                    tableCapacity: hosting.tableCapacity ? parseInt(hosting.tableCapacity) : undefined,
                    kitchenNotes: hosting.kitchenNotes,
                  }, setSavingKitchen)} />
                </div>
              )}

              {/* ── Dietary ── */}
              {activeSection === 'dietary' && (
                <div className="space-y-6">
                  <Field label="Restrictions alimentaires parmi vos convives"
                    hint="Sélectionnez tout ce qui s'applique — le kooker adaptera son menu">
                    <div className="flex flex-wrap gap-2 mt-2">
                      {DIETARY_OPTIONS.map(opt => (
                        <CheckTag key={opt} label={opt}
                          checked={hosting.dietaryRestrictions.includes(opt)}
                          onChange={() => toggleMulti('dietaryRestrictions', opt)} />
                      ))}
                    </div>
                  </Field>
                  <Field label="Allergènes présents parmi vos convives"
                    hint="14 allergènes réglementaires — signalez tous ceux qui concernent votre groupe">
                    <div className="flex flex-wrap gap-2 mt-2">
                      {ALLERGEN_OPTIONS.map(opt => (
                        <CheckTag key={opt} label={opt}
                          checked={hosting.allergies.includes(opt)}
                          onChange={() => toggleMulti('allergies', opt)} />
                      ))}
                    </div>
                  </Field>
                  <SaveButton saving={savingDietary} onClick={() => saveHosting({
                    dietaryRestrictions: hosting.dietaryRestrictions,
                    allergies: hosting.allergies,
                  }, setSavingDietary)} />
                </div>
              )}

              {/* ── Notes ── */}
              {activeSection === 'notes' && (
                <div className="space-y-4">
                  <Field label="Message libre pour votre kooker"
                    hint="Animaux de compagnie, enfants en bas âge, ambiance souhaitée, préférences de présentation…">
                    <textarea value={hosting.hostingNotes}
                      onChange={e => setHosting(h => ({ ...h, hostingNotes: e.target.value }))}
                      placeholder="Nous avons un chat qui peut venir dans la cuisine. Préférence pour un dressage simple et convivial. La soirée est un anniversaire, ambiance festive souhaitée."
                      rows={7} className={textareaCls} />
                  </Field>
                  <SaveButton saving={savingNotes} onClick={() => saveHosting({ hostingNotes: hosting.hostingNotes }, setSavingNotes)} />
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default UserProfilePage;
