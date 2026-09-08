import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Plus, X } from 'lucide-react';

interface ConfigData {
  specialties?: string[];
  cities?: string[];
  allergens?: string[];
  serviceTypes?: string[];
  units?: string[];
  commissionKours?: number;
  commissionKook?: number;
  kookBaseGuests?: number;
  tooltipFruitsDesMer?: string;
  tooltipCommission?: string;
  ingredientsChoiceEnabled?: boolean;
  ingredientsChoiceDefault?: string;
  [key: string]: string[] | number | string | boolean | undefined;
}

const CONFIG_LABELS: Record<string, string> = {
  specialties: 'Spécialités culinaires',
  cities: 'Villes disponibles',
  allergens: 'Allergènes',
  serviceTypes: 'Types de service',
  units: 'Unités de mesure (ingrédients)',
};

function ConfigList({
  configKey,
  label,
  values,
  onSave,
}: {
  configKey: string;
  label: string;
  values: string[];
  onSave: (key: string, values: string[]) => Promise<void>;
}) {
  const [items, setItems] = useState<string[]>(values);
  const [newItem, setNewItem] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setItems(values); setDirty(false); }, [values]);

  const add = () => {
    const trimmed = newItem.trim();
    if (!trimmed || items.includes(trimmed)) return;
    setItems(prev => [...prev, trimmed]);
    setNewItem('');
    setDirty(true);
  };

  const remove = (item: string) => {
    setItems(prev => prev.filter(i => i !== item));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    await onSave(configKey, items);
    setSaving(false);
    setDirty(false);
  };

  return (
    <div className="bg-white rounded-[20px] p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-[#111125]">{label}</h2>
        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-1.5 bg-[#c1a0fd] text-white rounded-[12px] text-sm font-medium hover:bg-[#b090ed] disabled:opacity-50"
          >
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {items.map(item => (
          <span key={item} className="flex items-center gap-1.5 bg-[#f2f4fc] px-3 py-1.5 rounded-full text-sm text-[#111125]">
            {item}
            <button onClick={() => remove(item)} className="text-gray-400 hover:text-red-500 transition-colors">
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={`Ajouter ${label.toLowerCase()}...`}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-[12px] text-sm focus:outline-none focus:border-[#c1a0fd]"
        />
        <button
          onClick={add}
          className="p-2 bg-[#c1a0fd]/10 text-[#c1a0fd] rounded-[12px] hover:bg-[#c1a0fd]/20 transition-colors"
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}

function CommissionEditor({ label, description, configKey, value, onSave }: {
  label: string;
  description: string;
  configKey: string;
  value: number;
  onSave: (key: string, val: number) => Promise<void>;
}) {
  const [rate, setRate] = useState(value);
  const [saving, setSaving] = useState(false);
  const dirty = rate !== value;

  useEffect(() => { setRate(value); }, [value]);

  const save = async () => {
    setSaving(true);
    await onSave(configKey, Math.max(0, Math.min(100, rate)));
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-[20px] p-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-[#111125]">{label}</h2>
        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-1.5 bg-[#c1a0fd] text-white rounded-[12px] text-sm font-medium hover:bg-[#b090ed] disabled:opacity-50"
          >
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-4">{description}</p>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={rate}
          onChange={e => setRate(Math.round(Number(e.target.value)))}
          className="w-24 px-3 py-2 border border-gray-200 rounded-[12px] text-sm text-center focus:outline-none focus:border-[#c1a0fd]"
        />
        <span className="text-sm text-gray-500 font-medium">%</span>
        <span className="text-xs text-gray-400">→ Kooker reçoit {100 - rate}% du prix brut</span>
      </div>
    </div>
  );
}

function TextEditor({ label, description, configKey, value, onSave }: {
  label: string;
  description: string;
  configKey: string;
  value: string;
  onSave: (key: string, val: string) => Promise<void>;
}) {
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);
  const dirty = text !== value;

  useEffect(() => { setText(value); }, [value]);

  const save = async () => {
    setSaving(true);
    await onSave(configKey, text.trim());
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-[20px] p-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-[#111125]">{label}</h2>
        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-1.5 bg-[#c1a0fd] text-white rounded-[12px] text-sm font-medium hover:bg-[#b090ed] disabled:opacity-50"
          >
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-4">{description}</p>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={3}
        className="w-full px-3 py-2 border border-gray-200 rounded-[12px] text-sm focus:outline-none focus:border-[#c1a0fd] resize-none"
      />
    </div>
  );
}

function NumberEditor({ label, description, configKey, value, min, onSave }: {
  label: string;
  description: string;
  configKey: string;
  value: number;
  min?: number;
  onSave: (key: string, val: number) => Promise<void>;
}) {
  const [val, setVal] = useState(value);
  const [saving, setSaving] = useState(false);
  const dirty = val !== value;

  useEffect(() => { setVal(value); }, [value]);

  const save = async () => {
    setSaving(true);
    await onSave(configKey, Math.max(min ?? 1, Math.round(val)));
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-[20px] p-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-[#111125]">{label}</h2>
        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-1.5 bg-[#c1a0fd] text-white rounded-[12px] text-sm font-medium hover:bg-[#b090ed] disabled:opacity-50"
          >
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-4">{description}</p>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={min ?? 1}
          step={1}
          value={val}
          onChange={e => setVal(Math.max(min ?? 1, Math.round(Number(e.target.value))))}
          className="w-24 px-3 py-2 border border-gray-200 rounded-[12px] text-sm text-center focus:outline-none focus:border-[#c1a0fd]"
        />
        <span className="text-sm text-gray-500 font-medium">personnes</span>
      </div>
    </div>
  );
}

export default function AdminConfigPage() {
  const [config, setConfig] = useState<ConfigData>({});
  const [commissionKours, setCommissionKours] = useState<number>(20);
  const [commissionKook, setCommissionKook] = useState<number>(20);
  const [kookBaseGuests, setKookBaseGuests] = useState<number>(6);
  const [tooltipFruitsDesMer, setTooltipFruitsDesMer] = useState<string>("produits de la mer à l'exception des poissons");
  const [tooltipCommission, setTooltipCommission] = useState<string>("La commission Weekook est prélevée sur chaque réservation. Elle couvre les frais de la plateforme, le paiement sécurisé et l'assistance client.");
  const [ingredientsChoiceEnabled, setIngredientsChoiceEnabled] = useState<boolean>(true);
  const [ingredientsChoiceDefault, setIngredientsChoiceDefault] = useState<string>('client');
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = 'Admin — Configuration | Weekook'; }, []);

  useEffect(() => {
    api.get<ConfigData>('/admin/config').then(res => {
      if (res.success && res.data) {
        setConfig(res.data);
        if (typeof res.data.commissionKours === 'number') setCommissionKours(res.data.commissionKours);
        if (typeof res.data.commissionKook === 'number') setCommissionKook(res.data.commissionKook);
        if (typeof res.data.kookBaseGuests === 'number') setKookBaseGuests(res.data.kookBaseGuests);
        if (typeof res.data.tooltipFruitsDesMer === 'string') setTooltipFruitsDesMer(res.data.tooltipFruitsDesMer);
        if (typeof res.data.tooltipCommission === 'string') setTooltipCommission(res.data.tooltipCommission);
        if (typeof res.data.ingredientsChoiceEnabled === 'boolean') setIngredientsChoiceEnabled(res.data.ingredientsChoiceEnabled);
        if (typeof res.data.ingredientsChoiceDefault === 'string') setIngredientsChoiceDefault(res.data.ingredientsChoiceDefault);
      }
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async (key: string, values: string[]) => {
    const res = await api.put(`/admin/config/${key}`, { value: values });
    if (res.success && res.data) setConfig(prev => ({ ...prev, [key]: values }));
  };

  const handleNumberSave = async (key: string, val: number) => {
    const res = await api.put(`/admin/config/${key}`, { value: val });
    if (res.success) {
      if (key === 'commissionKours') setCommissionKours(val);
      if (key === 'commissionKook') setCommissionKook(val);
      if (key === 'kookBaseGuests') setKookBaseGuests(val);
    }
  };

  const handleTextSave = async (key: string, val: string) => {
    const res = await api.put(`/admin/config/${key}`, { value: val });
    if (res.success) {
      if (key === 'tooltipFruitsDesMer') setTooltipFruitsDesMer(val);
      if (key === 'tooltipCommission') setTooltipCommission(val);
      if (key === 'ingredientsChoiceDefault') setIngredientsChoiceDefault(val);
    }
  };

  const handleBooleanSave = async (key: string, val: boolean) => {
    const res = await api.put(`/admin/config/${key}`, { value: val });
    if (res.success) {
      if (key === 'ingredientsChoiceEnabled') setIngredientsChoiceEnabled(val);
    }
  };

  const configKeys = ['specialties', 'cities', 'allergens', 'serviceTypes', 'units'];

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#111125] mb-2">Configuration</h1>
      <p className="text-sm text-gray-500 mb-6">
        Modifiez les paramètres et listes de valeurs utilisées dans l'application.
      </p>

      {loading ? (
        <div className="text-gray-400 text-sm">Chargement...</div>
      ) : (
        <div className="space-y-4">
          <CommissionEditor
            label="Commission KOURS"
            description="Pourcentage prélevé sur les prestations de type COURS de cuisine."
            configKey="commissionKours"
            value={commissionKours}
            onSave={handleNumberSave}
          />
          <CommissionEditor
            label="Commission KOOK"
            description="Pourcentage prélevé sur les prestations de type KOOK (repas à domicile)."
            configKey="commissionKook"
            value={commissionKook}
            onSave={handleNumberSave}
          />
          <NumberEditor
            label="Forfait de base KOOK (nombre de convives)"
            description="Nombre de personnes inclus dans le forfait de base pour une prestation KOOK. Le client paie ce forfait même pour moins de personnes."
            configKey="kookBaseGuests"
            value={kookBaseGuests}
            min={1}
            onSave={handleNumberSave}
          />
          {/* ── Gestion des ingrédients ── */}
          <div className="bg-white rounded-[20px] p-6">
            <h2 className="font-semibold text-[#111125] mb-1">Choix des ingrédients — toggle client / kooker</h2>
            <p className="text-sm text-gray-500 mb-5">Permet au client de choisir si c'est lui ou le kooker qui achète les ingrédients.</p>
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="text-[14px] font-medium text-[#111125]">Afficher le toggle sur les pages publiques</p>
                <p className="text-[12px] text-gray-400 mt-0.5">Si désactivé, seule l'option "client achète" est disponible</p>
              </div>
              <button
                type="button"
                onClick={() => handleBooleanSave('ingredientsChoiceEnabled', !ingredientsChoiceEnabled)}
                className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${ingredientsChoiceEnabled ? 'bg-[#c1a0fd]' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${ingredientsChoiceEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between pt-3">
              <div>
                <p className="text-[14px] font-medium text-[#111125]">Choix par défaut</p>
                <p className="text-[12px] text-gray-400 mt-0.5">Option pré-sélectionnée à l'arrivée sur la page</p>
              </div>
              <div className="flex gap-2">
                {(['client', 'kooker'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => handleTextSave('ingredientsChoiceDefault', v)}
                    className={`px-4 py-1.5 rounded-[10px] text-[13px] font-semibold border transition-all cursor-pointer ${
                      ingredientsChoiceDefault === v
                        ? 'bg-[#c1a0fd] border-[#c1a0fd] text-white'
                        : 'bg-white border-gray-200 text-[#303044] hover:border-[#c1a0fd]'
                    }`}
                  >
                    {v === 'client' ? '🛒 Client achète' : '👨‍🍳 Kooker fournit'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <TextEditor
            label="Tooltip — Allergène Fruits de mer"
            description={`Texte affiché au survol du ⓘ à côté de "Fruits de mer" dans les formulaires de création/édition d'offre.`}
            configKey="tooltipFruitsDesMer"
            value={tooltipFruitsDesMer}
            onSave={handleTextSave}
          />
          <TextEditor
            label="Tooltip — Commission Weekook"
            description="Texte affiché au survol du ⓘ sur la simulation de revenus (KOURS et KOOK) dans les formulaires de création/édition d'offre."
            configKey="tooltipCommission"
            value={tooltipCommission}
            onSave={handleTextSave}
          />
          {configKeys.map(key => (
            <ConfigList
              key={key}
              configKey={key}
              label={CONFIG_LABELS[key] ?? key}
              values={Array.isArray(config[key]) ? config[key] as string[] : []}
              onSave={handleSave}
            />
          ))}
        </div>
      )}
    </div>
  );
}
