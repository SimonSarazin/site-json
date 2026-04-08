import { useState, useRef, useEffect } from "react";
import { X, ChevronDown } from "lucide-react";
import { ALL_THEME } from "@/modules/search/schema";

type ThematicEntry = [string, { name: string; icon: string; tags: string[] }];
const THEMATIC_OPTIONS = Object.entries(ALL_THEME) as ThematicEntry[];

interface MultiSelectThematicsProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function MultiSelectThematics({ value, onChange }: MultiSelectThematicsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Fermer le dropdown en cliquant à l'extérieur
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = THEMATIC_OPTIONS.filter(([, theme]) =>
    theme.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRemove = (key: string) => {
    onChange(value.filter(v => v !== key));
  };

  const handleToggle = (key: string) => {
    if (value.includes(key)) {
      handleRemove(key);
    } else {
      onChange([...value, key]);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Tags affichés */}
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map(key => {
          const theme = ALL_THEME[key as keyof typeof ALL_THEME];
          return (
            <div
              key={key}
              className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-red-600 border border-red-600 rounded-full hover:bg-red-50"
            >
              <span>{theme.name}</span>
              <button
                type="button"
                onClick={() => handleRemove(key)}
                className="ml-1 hover:bg-red-200 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Input et Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 text-left border border-gray-300 rounded-md bg-white flex items-center justify-between hover:bg-gray-50"
        >
          <input
            type="text"
            placeholder="Rechercher une thématique..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onClick={() => setIsOpen(true)}
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown list */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 border border-gray-300 rounded-md bg-white shadow-lg max-h-56 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(([key, theme]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    handleToggle(key);
                    setSearchTerm("");
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2 ${
                    value.includes(key)
                      ? "bg-blue-100 font-semibold text-blue-700"
                      : "text-gray-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={value.includes(key)}
                    onChange={() => {}}
                    className="w-4 h-4"
                  />
                  {theme.name}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">
                Aucune thématique trouvée
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
