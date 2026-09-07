import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import type { FieldErrors } from "react-hook-form";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import type { FormFieldMapping, FinderValue, FinderElement, FinderConfig } from "../types";
import { FinderElementCard } from "./FinderElementCard";
import { FinderSearchModal } from "./FinderSearchModal";
import { FieldError, FieldLabel, HintText } from "./FormFields";
import { useFinderElementImages, mergeResolvedFinderImages } from "../hooks/useFinderElementImages";

interface FinderFieldProps {
  field: FormFieldMapping;
  errors: FieldErrors;
  value?: FinderValue;
  onChange?: (value: FinderValue) => void;
  /** Mode lecture seule */
  readOnly?: boolean;
  /** Masquer le label interne (ex: en mode readOnly avec label externe) */
  hideLabel?: boolean;
  /** URL de base pour les images */
  baseUrl?: string;
}

/**
 * Configuration par défaut du Finder
 */
const defaultFinderConfig: FinderConfig = {
  type: "organizations",
  filters: [],
  excludeFilters: [],
  notSourceKey: true,
  myContacts: false,
  initCurrentUser: false,
  elementLabel: "Élément",
  buttonLabel: "Rechercher et ajouter",
  placeholderSearchField: "Entrez le nom de l'élément recherché",
  field: "element",
  multiple: true,
  addNew: false,
  invite: false,
  linkToAnswer: false,
  singleAnswerPerElement: false,
  msgSingleAnswerPerElement: "",
  redirectSingleAnswerPerElement: "Accueil",
  editElement: false,
  addToLinks: { value: false, links: "" },
};

/**
 * Composant pour le champ Finder
 * Permet de rechercher et sélectionner des éléments (organisations, personnes, etc.)
 */
export function FinderField({
  field,
  errors,
  value,
  onChange,
  readOnly = false,
  hideLabel = false,
  baseUrl = "",
}: FinderFieldProps) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fusionner la config du champ avec les valeurs par défaut
  const config: FinderConfig = useMemo(() => {
    return { ...defaultFinderConfig, ...field.finderConfig };
  }, [field.finderConfig]);

  // Éléments sélectionnés (valeur actuelle)
  const selectedElements: Record<string, FinderElement> = useMemo(() => {
    return value || {};
  }, [value]);

  // Nombre d'éléments sélectionnés
  const selectedCount = Object.keys(selectedElements).length;

  // L'`img` n'est plus stockée dans la réponse (résolue live, source de vérité
  // = l'entité). On la résout ici pour l'affichage, sans jamais muter la valeur
  // RHF. Cf. useFinderElementImages + le strip dans formParser.
  const resolvedImages = useFinderElementImages(value ?? null);
  const displayElements = useMemo(
    () => mergeResolvedFinderImages(value ?? null, resolvedImages),
    [value, resolvedImages],
  );

  /**
   * Ouvre le modal de recherche
   */
  const handleOpenSearch = () => {
    if (!readOnly) {
      setIsModalOpen(true);
    }
  };

  /**
   * Ajoute les éléments sélectionnés
   */
  const handleAddElements = (elements: FinderElement[]) => {
    if (!onChange) return;

    const newValue = { ...selectedElements };
    
    // Si mode single, on remplace
    if (!config.multiple) {
      Object.keys(newValue).forEach((key) => delete newValue[key]);
    }

    // Ajouter les nouveaux éléments
    elements.forEach((el) => {
      newValue[el.id] = el;
    });

    onChange(newValue);
    setIsModalOpen(false);
  };

  /**
   * Supprime un élément sélectionné
   */
  const handleRemoveElement = (elementId: string) => {
    if (!onChange) return;

    const newValue = { ...selectedElements };
    delete newValue[elementId];

    // Si plus d'éléments, renvoyer null
    onChange(Object.keys(newValue).length > 0 ? newValue : null);
  };

  /**
   * Édite un élément (placeholder).
   *
   * @future Hook prévu pour ouvrir un formulaire d'édition contextuel d'un
   * élément sélectionné par le Finder (org/citoyen/etc.). Tant que la feature
   * n'est pas implémentée, le bouton "Edit" est désactivé côté UI (cf. prop
   * `canEdit={false}` ci-dessous) — la config backend `editElement: true` est
   * donc ignorée volontairement. À activer en remplaçant le toast par
   * l'ouverture d'un modal d'édition + en restaurant `canEdit={config.editElement && !readOnly}`.
   */
  const handleEditElement = (element: FinderElement) => {
    if (import.meta.env.DEV) console.log("Edit element:", element);
    toast.info(`Fonctionnalité à implémenter : éditer l'élément « ${element.name} »`);
  };

  const hasError = !!errors[field.name];

  return (
    <div className={cn("space-y-2", field.width || "col-span-12")}>
      {/* Label — `<div>` (et pas `<label>`) car le control n'est pas un input
          mais un bouton ouvrant un modal. Un `<label>` sans `htmlFor` n'a aucun
          effet a11y. Le bouton ci-dessous porte son propre `aria-label`. */}
      {!hideLabel && <FieldLabel field={field} id={`${field.name}-label`} />}

      {/* Info/Description */}
      {field.info && <HintText text={field.info} />}

      {/* Bouton de recherche — relié au label via `aria-labelledby` pour lier
          le titre du champ au control effectif (un bouton, pas un input). */}
      {!readOnly && (
        <button
          type="button"
          onClick={handleOpenSearch}
          aria-labelledby={!hideLabel ? `${field.name}-label` : undefined}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? `${field.name}-error` : undefined}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg",
            "text-muted-foreground hover:bg-muted/50 hover:border-primary/50 transition-colors",
            "outline-none focus-visible:ring-2 focus-visible:ring-ring",
            hasError && "border-destructive"
          )}
        >
          <Search aria-hidden="true" className="w-5 h-5" />
          <span>{config.buttonLabel}</span>
        </button>
      )}

      {/* Liste des éléments sélectionnés */}
      {selectedCount > 0 && (
        <div className="space-y-2 mt-3">
          {displayElements.map((element) => (
            <FinderElementCard
              key={element.id}
              element={element}
              canRemove={!readOnly}
              // canEdit forcé false tant que handleEditElement est un placeholder
              // (cf. @future ci-dessus). La config backend `editElement: true`
              // est volontairement ignorée pour ne pas afficher un bouton qui
              // mènerait à un toast "à implémenter".
              canEdit={false}
              onRemove={handleRemoveElement}
              onEdit={handleEditElement}
              baseUrl={baseUrl}
            />
          ))}
        </div>
      )}

      {/* Message d'erreur */}
      <FieldError
        name={field.name}
        message={
          hasError
            ? (errors[field.name]?.message?.toString() || String(t("coform.finder.requiredField")))
            : undefined
        }
      />

      {/* Modal de recherche — mount conditionnel : à chaque ouverture, le composant
          est créé à neuf et son state interne est frais (plus de useEffect reset). */}
      {isModalOpen && (
        <FinderSearchModal
          config={config}
          selectedElements={selectedElements}
          onClose={() => setIsModalOpen(false)}
          onValidate={handleAddElements}
          baseUrl={baseUrl}
        />
      )}
    </div>
  );
}
