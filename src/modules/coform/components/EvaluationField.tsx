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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { FieldError, FieldLabel, HintText } from "./FormFields";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import "../i18n/i18n";

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
      {/* Label — `<div>` car le control n'est pas un input ciblable
          (la <table> ne peut pas être focusée). `aria-labelledby` ci-dessous
          lie le titre à la table pour les screen readers. */}
      {!hideLabel && <FieldLabel field={field} id={`${field.name}-label`} hasError={hasError} />}

      {/* Info/description */}
      {field.info && <HintText text={field.info} />}

      {/* Table d'évaluation */}
      <ScrollArea className="border rounded-md w-full">
        <table
          className="w-full border-collapse text-sm"
          aria-labelledby={!hideLabel ? `${field.name}-label` : undefined}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? `${field.name}-error` : undefined}
        >
          <colgroup>
            {Array.from({ length: categoryNumber }, (_, i) => (
              <col key={`cat-${i}`} />
            ))}
            {criteriaIds.map((criteriaId) => (
              <col key={`crit-${criteriaId}`} className="w-32" />
            ))}
          </colgroup>
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
                  {/* Colonnes de catégorie — */}
                  {Array.from({ length: categoryNumber }, (_, i) => (
                    <td
                      key={i}
                      className="p-2 border-r border-border wrap-break-word min-w-176"
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
        <ScrollBar orientation="horizontal" className="h-2" />
      </ScrollArea>

      {/* Message d'erreur */}
      <FieldError name={field.name} message={errors[field.name]?.message as string | undefined} />
    </div>
  );
}
