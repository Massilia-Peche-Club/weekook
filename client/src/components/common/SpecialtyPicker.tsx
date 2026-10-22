import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '@/lib/api';

interface SpecialtyPickerProps {
  selected: string[];
  onChange: (specialties: string[]) => void;
}

/**
 * Choix des spécialités parmi la liste gérée dans l'admin (Configuration),
 * pour que les filtres de recherche retrouvent les kookers et les offres.
 * Une spécialité déjà enregistrée mais absente de la liste reste affichée
 * (« hors liste ») pour pouvoir être retirée ; elle ne peut pas être ajoutée.
 */
export default function SpecialtyPicker({ selected, onChange }: SpecialtyPickerProps) {
  const [available, setAvailable] = useState<string[] | null>(null);

  useEffect(() => {
    api.get<{ specialties?: string[] }>('/admin/config/public')
      .then((res) => setAvailable(Array.isArray(res.data?.specialties) ? res.data!.specialties : []))
      .catch(() => setAvailable([]));
  }, []);

  if (available === null) {
    return <div className="h-[34px] w-full max-w-[320px] bg-[#f2f4fc] rounded-[8px] animate-pulse" />;
  }

  const legacy = selected.filter((s) => !available.includes(s));

  const toggle = (s: string) =>
    onChange(selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s]);

  if (available.length === 0 && legacy.length === 0) {
    return <p className="text-[13px] text-[#828294]">Aucune spécialité configurée — ajoutez-en depuis la page Admin.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {available.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => toggle(s)}
          className={`min-h-[36px] px-3 py-1.5 text-[13px] font-semibold rounded-[8px] transition-all cursor-pointer border ${
            selected.includes(s)
              ? 'bg-[#c1a0fd] border-[#c1a0fd] text-white'
              : 'bg-white border-[#e0e2ef] text-[#303044] hover:border-[#c1a0fd] hover:text-[#c1a0fd]'
          }`}
        >
          {s}
        </button>
      ))}
      {legacy.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => toggle(s)}
          title="Cette spécialité n'est plus proposée : cliquez pour la retirer"
          className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold rounded-[8px] border border-dashed border-[#c0c0cc] bg-[#f8f9fb] text-[#828294] hover:border-red-300 hover:text-red-500 transition-all cursor-pointer"
        >
          {s} <span className="font-normal">(hors liste)</span>
          <X className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  );
}
