import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

/** Rayons proposés pour la zone d'intervention d'un kooker (km) */
export const SERVICE_RADIUS_OPTIONS = [5, 10, 20, 30, 50, 100];

/** Suggestion renvoyée par l'API (les coordonnées restent côté serveur) */
export interface PlaceSuggestion {
  label: string;
  city: string;
  postalCode: string | null;
}

interface PlaceAutocompleteProps {
  /** `cities` : communes (profil kooker) — `addresses` : adresses complètes (lieu de la prestation) */
  kind: 'cities' | 'addresses';
  value: string;
  onChange: (text: string) => void;
  onSelect: (place: PlaceSuggestion) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export default function PlaceAutocomplete({
  kind,
  value,
  onChange,
  onSelect,
  placeholder = kind === 'cities' ? 'Ville ou code postal' : 'Adresse de la prestation',
  className = '',
  required,
}: PlaceAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Suggestions uniquement quand l'utilisateur tape (pas au chargement d'une valeur existante)
  useEffect(() => {
    if (!typed || value.trim().length < (kind === 'cities' ? 2 : 3)) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      api.get<PlaceSuggestion[]>(`/geo/${kind}?q=${encodeURIComponent(value.trim())}`)
        .then((res) => {
          setSuggestions(res.success && res.data ? res.data : []);
          setOpen(true);
        })
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [value, typed, kind]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const select = (place: PlaceSuggestion) => {
    setTyped(false);
    setOpen(false);
    setSuggestions([]);
    onSelect(place);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => { setTyped(true); onChange(e.target.value); }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && open && suggestions.length > 0) {
            e.preventDefault();
            select(suggestions[0]);
          }
        }}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        className={className}
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-30 left-0 right-0 mt-1 bg-white border border-[#e0e2ef] rounded-[12px] shadow-lg overflow-hidden max-h-[260px] overflow-y-auto">
          {suggestions.map((place) => (
            <li key={place.label}>
              <button
                type="button"
                onClick={() => select(place)}
                className="w-full text-left px-4 py-2.5 text-[14px] text-[#111125] hover:bg-[#f3ecff] transition-colors cursor-pointer"
              >
                {place.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
