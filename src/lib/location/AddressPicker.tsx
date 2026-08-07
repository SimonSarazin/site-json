import { useState } from "react";
import { MapPin, X, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AddressEditor } from "./AddressEditor";
import type { FormLocalityEntry } from "./types";

interface AddressPickerProps {
  value: FormLocalityEntry[];
  onChange: (entries: FormLocalityEntry[]) => void;
  /** Autorise plusieurs adresses (défaut true). `false` = une seule. */
  multiple?: boolean;
  /** Filtre optionnel de codes pays autorisés. */
  countries?: string[];
}

function formatEntry(e: FormLocalityEntry): string {
  const a = e.address;
  return [a.streetAddress, a.postalCode, a.addressLocality, a.addressCountry].filter(Boolean).join(", ") || a.addressLocality || "—";
}

/**
 * Garantit qu'EXACTEMENT une entrée porte `center` (la 1re marquée, sinon la 1re).
 * Nécessaire car `buildLocalityEntry` marque `center:true` par défaut sur chaque
 * adresse fraîche : sans dédup, la 2ᵉ adresse produirait un 2ᵉ centre.
 */
function withSingleCenter(entries: FormLocalityEntry[]): FormLocalityEntry[] {
  if (!entries.length) return entries;
  const centerIdx = entries.findIndex((e) => e.center);
  const keep = centerIdx === -1 ? 0 : centerIdx;
  return entries.map((e, i) => ({ ...e, center: i === keep }));
}

/**
 * Sélecteur d'adresses géolocalisées contrôlé (multi-adresses) — parité dynForm `formLocality`.
 * Produit un tableau `FormLocalityEntry[]` avec une adresse principale (`center`).
 *
 * **Auto-commit** : dès que l'adresse en cours d'édition possède un `localityId`
 * (ville choisie), elle entre — et se met à jour — dans `value`. Aucun clic
 * « Ajouter » n'est requis pour ne rien perdre à la sauvegarde (footgun corrigé,
 * et conforme au dynForm où sélectionner une ville capture l'adresse). Le bouton
 * « Ajouter une autre adresse » ne sert qu'à EN saisir une SECONDE.
 *
 * S'appuie sur `AddressEditor` (le cœur partagé) pour composer chaque adresse.
 */
export function AddressPicker({ value, onChange, multiple = true, countries }: AddressPickerProps) {
  // Adresse actuellement ouverte dans l'AddressEditor (peut être incomplète).
  const [active, setActive] = useState<FormLocalityEntry | null>(null);
  // `active` occupe-t-elle déjà la DERNIÈRE case de `value` (auto-committée) ?
  const [activeCommitted, setActiveCommitted] = useState(false);
  // Remonte l'AddressEditor pour repartir d'un formulaire vierge après un ajout.
  const [editorKey, setEditorKey] = useState(0);

  const emit = (entries: FormLocalityEntry[]) => onChange(withSingleCenter(entries));

  const handleEditorChange = (entry: FormLocalityEntry | null) => {
    setActive(entry);
    const valid = Boolean(entry?.address?.localityId);

    if (valid && entry) {
      if (activeCommitted) {
        // Affinage (CP / rue / pays) : on met à jour la dernière entrée en
        // préservant son drapeau `center` (l'éditeur ne le porte pas).
        const prev = value[value.length - 1];
        emit([...value.slice(0, -1), { ...entry, center: prev?.center }]);
      } else {
        setActiveCommitted(true);
        emit([...value, entry]);
      }
    } else if (activeCommitted) {
      // La ville a été retirée (changement de pays) → on décommite.
      setActiveCommitted(false);
      emit(value.slice(0, -1));
    }
  };

  const handleAddAnother = () => {
    setActive(null);
    setActiveCommitted(false);
    setEditorKey((k) => k + 1);
  };

  const removeAt = (index: number) => {
    const removingActive = activeCommitted && index === value.length - 1;
    if (removingActive) {
      setActive(null);
      setActiveCommitted(false);
      setEditorKey((k) => k + 1);
    }
    emit(value.filter((_, i) => i !== index));
  };

  const setPrincipal = (index: number) => {
    onChange(value.map((e, i) => ({ ...e, center: i === index })));
  };

  // Lignes = adresses committées SAUF celle en cours d'édition (dernière case
  // quand activeCommitted), déjà représentée par l'éditeur ci-dessous.
  const rows = activeCommitted ? value.slice(0, -1) : value;
  const showEditor = multiple || value.length === 0 || activeCommitted;
  const showAddAnother = multiple && activeCommitted;

  return (
    <div className="space-y-4">
      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((e, i) => (
            <li key={i} className="flex items-center gap-2 rounded-md border p-2 text-sm">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 wrap-break-word">{formatEntry(e)}</span>
              {value.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Adresse principale"
                  onClick={() => setPrincipal(i)}
                  className={cn("h-7 w-7", e.center ? "text-primary" : "text-muted-foreground")}
                >
                  <Star className={cn("h-4 w-4", e.center && "fill-current")} />
                </Button>
              )}
              <Button type="button" variant="ghost" size="icon" title="Supprimer" onClick={() => removeAt(i)} className="h-7 w-7 text-destructive">
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {showEditor && (
        <div className="space-y-3 rounded-md border p-3">
          <AddressEditor key={editorKey} value={active} onChange={handleEditorChange} countries={countries} />
        </div>
      )}

      {showAddAnother && (
        <div className="flex justify-end">
          <Button type="button" size="sm" variant="outline" onClick={handleAddAnother}>
            Ajouter une autre adresse
          </Button>
        </div>
      )}
    </div>
  );
}

export default AddressPicker;
