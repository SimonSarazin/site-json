import { useMemo, useCallback } from "react";
import type { FieldErrors } from "react-hook-form";
import { cn } from "@/lib/utils";
import type {
  FormFieldMapping,
  EvaluationValue,
  EvaluationCategories,
  EvaluationVoteValue,
} from "../types";
import { EvaluationVoteCell } from "./EvaluationVoteCell";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import "../i18n/i18n";

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

/**
 * Ligne aplatie d'une catégorie
 */
interface FlattenedRow {
  /** Chemin complet (ex: "Cat1.SubCat1.Item1") */
  path: string;
  /** Segments individuels du chemin (pour les colonnes de catégorie) */
  segments: string[];
}

interface EvaluationFieldProps {
  field: FormFieldMapping;
  errors: FieldErrors;
  value?: EvaluationValue;
  onChange?: (value: EvaluationValue) => void;
  readOnly?: boolean;
  hideLabel?: boolean;
}

/**
 * Aplatit une structure hiérarchique de catégories en lignes
 */
function flattenCategories(
  categories: EvaluationCategories,
  categoryNumber: number,
  parentPath: string[] = []
): FlattenedRow[] {
  const rows: FlattenedRow[] = [];

  for (const [key, value] of Object.entries(categories)) {
    const currentPath = [...parentPath, key];

    if (Array.isArray(value)) {
      // C'est une feuille (array de strings vides ou valeurs)
      // On a atteint le niveau final
      rows.push({
        path: currentPath.join("."),
        segments: currentPath,
      });
    } else if (typeof value === "object" && value !== null) {
      // C'est un sous-objet, continuer à descendre
      const subRows = flattenCategories(value, categoryNumber, currentPath);
      rows.push(...subRows);
    }
  }

  return rows;
}

/**
 * Composant pour le champ evaluation
 * Tableau d'évaluation avec catégories (lignes) et critères (colonnes)
 */
export function EvaluationField({
  field,
  errors,
  value = {},
  onChange,
  readOnly,
  hideLabel,
}: EvaluationFieldProps) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");

  const config = field.evaluationConfig;
  const hasError = !!errors[field.name];

  // Valeurs par défaut de la configuration (memoized pour éviter les re-renders)
  const categories = useMemo(() => config?.categories || {}, [config?.categories]);
  const criterias = useMemo(() => config?.criterias || {}, [config?.criterias]);
  const criteriaLabel = config?.criteriaLabel || "";
  const categoryNumber = config?.categoryNumber || 1;
  const categoryTitle = config?.categoryTitle || "";
  const multiVotePerLine = config?.multiVotePerLine || false;
  const voteType = config?.voteType || "colour";
  const colours = config?.colours || { OK: "#9fbd38", NotOK: "#D7193B" };
  const emojis = config?.emojis || ["😀", "🙂", "😐", "🙁", "😢"];
  const noteMax = config?.noteMax || 10;
  const starCount = config?.starCount || 5;

  // Aplatir les catégories en lignes
  const flatRows = useMemo(
    () => flattenCategories(categories, categoryNumber),
    [categories, categoryNumber]
  );

  // Liste des IDs de critères
  const criteriaIds = useMemo(() => Object.keys(criterias), [criterias]);

  // Gérer le changement de vote
  const handleVoteChange = useCallback(
    (rowPath: string, criteriaId: string, voteValue: EvaluationVoteValue) => {
      const newValue = { ...value };

      if (!newValue[rowPath]) {
        newValue[rowPath] = {};
      }

      if (!multiVotePerLine) {
        // Mode vote unique par ligne: effacer les autres votes de cette ligne
        newValue[rowPath] = {};
      }

      // Mettre à jour ou supprimer le vote
      if (voteValue === "" || voteValue === 0) {
        delete newValue[rowPath][criteriaId];
        // Nettoyer si la ligne est vide
        if (Object.keys(newValue[rowPath]).length === 0) {
          delete newValue[rowPath];
        }
      } else {
        newValue[rowPath][criteriaId] = voteValue;
      }

      onChange?.(newValue);
    },
    [value, onChange, multiVotePerLine]
  );

  // Obtenir la valeur d'un vote
  const getVoteValue = useCallback(
    (rowPath: string, criteriaId: string): EvaluationVoteValue => {
      return value[rowPath]?.[criteriaId] ?? "";
    },
    [value]
  );

  // Coloration alternée par groupe de catégorie de premier niveau
  const getRowBackgroundClass = useCallback(
    (segments: string[]): string => {
      if (segments.length === 0) return "";
      // Trouver l'index du groupe de premier niveau
      const firstLevelKeys = Object.keys(categories);
      const groupIndex = firstLevelKeys.indexOf(segments[0]);
      return groupIndex % 2 === 1 ? "bg-muted/30" : "";
    },
    [categories]
  );

  return (
    <div className={cn("space-y-2", field.width || "col-span-12")}>
      {/* Label */}
      {!hideLabel && (
        <label
          htmlFor={field.name}
          className={cn(
            "block text-sm font-medium",
            hasError && "text-destructive"
          )}
        >
          {field.label}
          {field.isRequired && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      {/* Info/description */}
      {field.info && <HintText text={field.info} />}

      {/* Table d'évaluation */}
      <div className="overflow-x-auto border rounded-md">
        <table className="w-full border-collapse text-sm min-w-max">
          <thead>
            {/* Ligne 1: Label catégorie + Label critères */}
            <tr className="border-b border-border">
              <th
                colSpan={categoryNumber}
                scope="colgroup"
                aria-hidden="true"
                className="text-center p-2 font-medium"
              >
                &nbsp;
              </th>
              {criteriaIds.length > 0 && (
                <th
                  colSpan={criteriaIds.length}
                  scope="colgroup"
                  className="text-center p-2 font-medium border-l border-border"
                >
                  {criteriaLabel}
                </th>
              )}
            </tr>

            {/* Ligne 2: Titre des catégories + Noms des critères */}
            <tr className="border-b border-border bg-muted/50">
              <th
                colSpan={categoryNumber}
                scope="colgroup"
                className="text-center p-2 font-medium min-w-24"
              >
                {categoryTitle}
              </th>
              {criteriaIds.map((criteriaId) => (
                <th
                  key={criteriaId}
                  scope="col"
                  className="text-center p-2 font-medium border-l border-border min-w-20"
                >
                  {criterias[criteriaId]?.name || criteriaId}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {flatRows.length === 0 ? (
              <tr>
                <td
                  colSpan={categoryNumber + criteriaIds.length}
                  className="text-center p-4 text-muted-foreground"
                >
                  {t("coform.evaluation.noCategories", "Aucune catégorie définie")}
                </td>
              </tr>
            ) : (
              flatRows.map((row) => (
                <tr
                  key={row.path}
                  className={cn(
                    "border-b border-border hover:bg-muted/20 transition-colors",
                    getRowBackgroundClass(row.segments)
                  )}
                >
                  {/* Colonnes de catégorie */}
                  {Array.from({ length: categoryNumber }, (_, i) => (
                    <td
                      key={i}
                      className="p-2 border-r border-border min-w-24 whitespace-nowrap"
                    >
                      {row.segments[i] || ""}
                    </td>
                  ))}

                  {/* Colonnes de vote (critères) */}
                  {criteriaIds.map((criteriaId) => (
                    <EvaluationVoteCell
                      key={criteriaId}
                      voteType={voteType}
                      value={getVoteValue(row.path, criteriaId)}
                      onChange={(v) => handleVoteChange(row.path, criteriaId, v)}
                      colours={colours}
                      emojis={emojis}
                      noteMax={noteMax}
                      starCount={starCount}
                      disabled={readOnly}
                    />
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Message d'erreur */}
      {hasError && (
        <p className="text-sm text-destructive">
          {errors[field.name]?.message as string}
        </p>
      )}
    </div>
  );
}
