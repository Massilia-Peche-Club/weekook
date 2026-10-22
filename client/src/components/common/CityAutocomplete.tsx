import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

/** Rayons proposés pour la zone d'intervention d'un kooker (km) */
export const SERVICE_RADIUS_OPTIONS = [5, 10, 20, 30, 50, 100];

export interface GeoPlace {
  label: string;
  city: string;
  postalCode: string | null;
  latitude: number;
  longitude: number;
}

interface CityAutocompleteProps {
  value: string;
  /** Saisie libre : la ville n'est plus validée tant qu'une suggestion n'est pas choisie */
  onChange: (text: string) => void;
  onSelect: (place: GeoPlace) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export default function CityAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Ville ou code postal',
  className = '',
  required,
}: CityAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<GeoPlace[]>([]);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Suggestions uniquement quand l'utilisateur tape (pas au chargement d'une valeur existante)
  useEffect(() => {
    if (!typed || value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      api.get<GeoPlace[]>(`/geo/cities?q=${encodeURIComponent(value.trim())}`)
        .then((res) => {
          setSuggestions(res.success && res.data ? res.data : []);
          setOpen(true);
        })
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [value, typed]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const select = (place: GeoPlace) => {
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
            <li key={`${place.label}-${place.latitude}-${place.longitude}`}>
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
