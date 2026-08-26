import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useCocolightOptional } from "@/hooks/useCocolight";
import { useSaveAapEvaluationNote } from "../actions/mutations/selection";
import {
  parseAapEvaluationConfig,
  buildCriterionValue,
  isNoteValid,
  toNumber,
  AAP_EVALUATION_NOTE_MAX,
  type RawAapEvaluationConfig,
  type AapEvaluationValue,
  type AapEvaluationCriterion,
} from "../utils/aapEvaluation";
import type { FormFieldMapping } from "../types";

/**
 * `tpls.forms.aap.evaluation` — grille de notation à critères libres.
 *
 * Même contrat que `SelectionField` et `PourContreField` : hors RHF, hors schéma
 * Zod, écriture immédiate par chemin ciblé. La particularité est la valeur
 * écrite : un OBJET `{label, note, coeff}` par critère, et non un scalaire.
 *
 * Ne comporte ni moyenne ni décompte : le legacy n'en affiche aucun.
 */

export interface AapEvaluationFieldProps {
  field: FormFieldMapping;
  subFormId: string;
  formId?: string | null;
  /** `form.evaluationCriteria`. */
  config?: RawAapEvaluationConfig | null;
  /** `{ <userId>: { <index>: {label, note, coeff} } }`. */
  value?: AapEvaluationValue | null;
  answerId?: string;
  readOnly?: boolean;
}

function StarRating({
  note,
  disabled,
  label,
  onRate,
}: {
  note: number;
  disabled: boolean;
  label: string;
  onRate: (n: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  // 5 étoiles pour une note sur 10 : chaque étoile vaut 2 points, ce qui garde
  // l'échelle de stockage du legacy tout en gardant un rendu lisible.
  const parEtoile = AAP_EVALUATION_NOTE_MAX / 5;
  const affichee = hover ?? note;
  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => {
        const valeur = n * parEtoile;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={note === valeur}
            aria-label={String(valeur)}
            disabled={disabled}
            onClick={() => onRate(valeur)}
            onMouseEnter={() => !disabled && setHover(valeur)}
            onMouseLeave={() => setHover(null)}
            className={cn("p-0.5 rounded", disabled ? "cursor-default" : "cursor-pointer")}
          >
            <Star
              className={cn(
                "size-5",
                valeur <= affichee ? "fill-primary text-primary" : "text-muted-foreground/40"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

export function AapEvaluationField({
  field,
  subFormId,
  formId,
  config,
  value,
  answerId,
  readOnly,
}: AapEvaluationFieldProps) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");
  const cocolight = useCocolightOptional();
  const currentUserId = cocolight?.me?.id ?? null;

  const saveNote = useSaveAapEvaluationNote({
    api: cocolight?.api ?? null,
    formId: formId ?? "",
    answerId,
  });

  const parsed = parseAapEvaluationConfig(config, currentUserId ? value?.[currentUserId] : null);

  // Même raison que ses deux cousins : l'écriture cible un document existant.
  if (!answerId) return null;

  const disabled = Boolean(readOnly) || !currentUserId;

  const noter = (critere: AapEvaluationCriterion, note: number) => {
    if (disabled || !currentUserId || !isNoteValid(note)) return;
    saveNote.mutate({
      subFormId,
      userId: currentUserId,
      index: critere.index,
      value: buildCriterionValue(critere, note),
    });
  };

  return (
    <div className={cn("space-y-3", field.width || "col-span-12")}>
      {field.label && (
        <div className="block text-base font-semibold leading-snug text-foreground">
          {field.label}
        </div>
      )}

      {parsed.criteria.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          {t("coform.aapEvaluation.noCriteria", "Aucun critère d'évaluation n'a été configuré.")}
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {parsed.criteria.map((critere) => (
            <li key={critere.index} className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-sm font-medium">
                {critere.label}
                {critere.coeff !== 1 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ×{critere.coeff}
                  </span>
                )}
              </span>
              {parsed.voteType === "starCriterionBased" ? (
                <StarRating
                  note={critere.note}
                  disabled={disabled}
                  label={critere.label}
                  onRate={(n) => noter(critere, n)}
                />
              ) : (
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={AAP_EVALUATION_NOTE_MAX}
                  step="0.5"
                  defaultValue={critere.note || ""}
                  disabled={disabled}
                  aria-label={critere.label}
                  className="w-24 h-8"
                  // Écriture au blur, comme le legacy : pas d'appel réseau à
                  // chaque frappe.
                  onBlur={(e) => {
                    const saisie = e.target.value.trim();
                    if (saisie === "") return;
                    const n = toNumber(saisie);
                    if (n === critere.note) return;
                    noter(critere, n);
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
