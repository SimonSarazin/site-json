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

// Import HintText pour afficher l'info en markdown
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function HintText({ text }: { text: string }) {
  return (
    <div className="text-xs text-muted-foreground -mt-1 mb-1 prose prose-xs dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:m-0 [&>ol]:m-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

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
   * TODO: Ouvrir le formulaire d'édition de l'élément.
   */
  const handleEditElement = (element: FinderElement) => {
    console.log("Edit element:", element);
    toast.info(`Fonctionnalité à implémenter : éditer l'élément « ${element.name} »`);
  };

  const hasError = !!errors[field.name];

  return (
    <div className={cn("space-y-2", field.width || "col-span-12")}>
      {/* Label */}
      {!hideLabel && (
        <label className="block">
          <span className="text-sm font-medium">
            {field.label}
            {field.isRequired && <span className="text-destructive ml-1">*</span>}
          </span>
        </label>
      )}

      {/* Info/Description */}
      {field.info && <HintText text={field.info} />}

      {/* Bouton de recherche */}
      {!readOnly && (
        <button
          type="button"
          onClick={handleOpenSearch}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg",
            "text-muted-foreground hover:bg-muted/50 hover:border-primary/50 transition-colors",
            hasError && "border-destructive"
          )}
        >
          <Search className="w-5 h-5" />
          <span>{config.buttonLabel}</span>
        </button>
      )}

      {/* Liste des éléments sélectionnés */}
      {selectedCount > 0 && (
        <div className="space-y-2 mt-3">
          {Object.values(selectedElements).map((element) => (
            <FinderElementCard
              key={element.id}
              element={element}
              canRemove={!readOnly}
              canEdit={config.editElement && !readOnly}
              onRemove={handleRemoveElement}
              onEdit={handleEditElement}
              baseUrl={baseUrl}
            />
          ))}
        </div>
      )}

      {/* Message d'erreur */}
      {hasError && (
        <p className="text-sm text-destructive">
          {errors[field.name]?.message?.toString() || String(t("coform.finder.requiredField"))}
        </p>
      )}

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
