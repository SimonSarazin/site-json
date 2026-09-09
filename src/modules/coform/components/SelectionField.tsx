import { useId, useMemo, useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useCocolightOptional } from "@/hooks/useCocolight";
import { useSaveSelectionNote, useSaveAdmissibility } from "../actions/mutations/selection";
import { useEcrituresLocales } from "../hooks/useEcrituresLocales";
import {
  parseSelectionConfig,
  computeSelectionMeans,
  withEvaluatorNotes,
  formatCriterionValue,
  toNote,
  type SelectionValue,
  type SelectionCriterion,
  type RawSelectionConfig,
} from "../utils/selection";
import { FieldLabel } from "./FormFields";
import type { FormFieldMapping } from "../types";

/**
 * `tpls.forms.aap.selection` — grille de notation d'un jury sur une candidature.
 *
 * Ce n'est pas un champ de formulaire ordinaire, et il ne se comporte pas comme
 * ses voisins :
 *
 *  - il n'a **pas** de `value`/`onChange` RHF et n'est **pas** au schéma Zod.
 *    La valeur est scopée par ÉVALUATEUR et le backend remplace en bloc toute
 *    clé non suffixée `_multiEval` : la soumettre effacerait les notes des
 *    autres. Voir `actions/mutations/selection.ts` ;
 *  - chaque note part **immédiatement** par chemin ciblé, comme le legacy ;
 *  - il lit les réponses d'une AUTRE étape (l'étape de dépôt) pour afficher, en
 *    regard de chaque critère, ce qu'a répondu le candidat.
 */

export interface SelectionFieldProps {
  field: FormFieldMapping;
  /** Clé de l'étape courante (celle qui porte `selection`). */
  subFormId: string;
  /** Id du formulaire parent — nécessaire pour cibler la réponse à l'écriture. */
  formId?: string | null;
  /** `params.configSelectionCriteria` du formulaire parent. */
  config?: RawSelectionConfig | null;
  /** Valeur actuelle : `{ <userId>: { <critère>: note } }`. */
  value?: SelectionValue | null;
  /** Avis d'admissibilité : `{ <userId>: "admissible" | … }`. */
  admissibility?: Record<string, unknown> | null;
  /** Réponses de l'étape de dépôt, pour la colonne « valeur du candidat ». */
  depositAnswers?: Record<string, unknown> | null;
  /** Libellés des questions de l'étape de dépôt. */
  depositLabels?: Record<string, string>;
  answerId?: string;
  readOnly?: boolean;
}

/** Notation par étoiles. `noteMax` vaut toujours 5 dans ce mode. */
function StarRating({
  note,
  max,
  disabled,
  label,
  onRate,
}: {
  note: number;
  max: number;
  disabled: boolean;
  label: string;
  onRate: (n: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const affichee = hover ?? note;
  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label={label}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={note === n}
          aria-label={String(n)}
          disabled={disabled}
          onClick={() => onRate(n)}
          onMouseEnter={() => !disabled && setHover(n)}
          onMouseLeave={() => setHover(null)}
          className={cn(
            "p-0.5 rounded transition-colors",
            disabled ? "cursor-default" : "cursor-pointer hover:scale-110"
          )}
        >
          <Star
            className={cn(
              "size-5",
              n <= affichee ? "fill-primary text-primary" : "text-muted-foreground/40"
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function SelectionField({
  field,
  subFormId,
  formId,
  config,
  value,
  admissibility,
  depositAnswers,
  depositLabels,
  answerId,
  readOnly,
}: SelectionFieldProps) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");
  const cocolight = useCocolightOptional();
  const currentUserId = cocolight?.me?.id ?? null;

  const saveNote = useSaveSelectionNote({
    api: cocolight?.api ?? null,
    formId: formId ?? "",
    answerId,
  });
  const saveAdmissibility = useSaveAdmissibility({
    api: cocolight?.api ?? null,
    formId: formId ?? "",
    answerId,
  });
  // Le formulaire ne resynchronise pas son instantané : sans ça, une note posée
  // ou un avis coché restent affichés à leur valeur d'avant, alors même que le
  // toast annonce l'enregistrement. Cf. `useEcrituresLocales`.
  // Une mémoire PAR CRITÈRE : le jury en note plusieurs à la suite.
  const echoNotes = useEcrituresLocales<unknown>();
  const echoAvis = useEcrituresLocales<unknown>();
  // Extraite pour que le `useMemo` ne dépende que d'elle (stable tant que rien
  // n'est écrit), pas de l'objet du hook, neuf à chaque rendu.
  const superposerNotes = echoNotes.superposer;
  // Critères dont la dernière saisie a été REFUSÉE (hors barème). Le refus
  // doit se voir : le champ ne porte plus de contrainte native (cf. l'input).
  const [refus, setRefus] = useState<Record<string, boolean>>({});
  const idRefus = useId();

  // Une seule passe pour les dérivations liées (config + valeur locale + moyennes).
  // L'écho porte sur la valeur ENTIÈRE : « Mon évaluation » et « Tous les
  // évaluateurs » en dérivent, et resteraient sur « — » / « (0) » sous des
  // étoiles pleines si seule la note du contrôle était rattrapée.
  const { parsed, mesNotes, means } = useMemo(() => {
    const p = parseSelectionConfig(config, depositLabels ?? {});
    const notes = superposerNotes(currentUserId ? value?.[currentUserId] : null);
    const locale = withEvaluatorNotes(value, currentUserId, notes);
    return {
      parsed: p,
      mesNotes: notes,
      means: computeSelectionMeans(locale, p.criteria, currentUserId),
    };
  }, [config, depositLabels, value, currentUserId, superposerNotes]);

  // Sans réponse enregistrée, il n'y a rien à cibler : l'écriture se fait par
  // chemin sur un document existant. Relevé en base, le cas ne se présente pas
  // (0 occurrence à l'étape de dépôt), mais rien n'empêche un admin d'y déplacer
  // l'input — mieux vaut ne rien afficher qu'un widget qui n'écrirait nulle part.
  if (!answerId) return null;

  const disabled = Boolean(readOnly) || !currentUserId;
  const monAvis = echoAvis.lire(
    "avis",
    currentUserId ? admissibility?.[currentUserId] : undefined
  );

  const estDansLeBareme = (note: number) =>
    Number.isFinite(note) && note >= 0 && note <= parsed.noteMax;

  const noter = (critere: SelectionCriterion, note: number) => {
    if (disabled || !currentUserId) return;
    if (!estDansLeBareme(note)) return;
    saveNote.mutate(
      { subFormId, userId: currentUserId, fieldKey: critere.fieldKey, note },
      // Après le serveur, jamais avant : un échec doit laisser la note réelle.
      { onSuccess: (_d, vars) => echoNotes.noter(vars.fieldKey, vars.note) }
    );
  };

  const formatMean = (m: number | null) =>
    m === null ? "—" : `${m} / ${parsed.noteMax}`;

  return (
    <div className={cn("space-y-4", field.width || "col-span-12")}>
      <FieldLabel field={field} />

      {parsed.criteria.length === 0 ? (
        // 76 formulaires sur 92 utilisent `selection` sans critères configurés.
        <p className="text-sm text-muted-foreground italic">
          {t("coform.selection.noCriteria", "Aucun critère d'évaluation n'a été configuré.")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-3 font-medium">
                  {t("coform.selection.criterion", "Critère")}
                </th>
                <th className="py-2 px-3 font-medium">
                  {t("coform.selection.candidateValue", "Réponse du candidat")}
                </th>
                <th className="py-2 pl-3 font-medium whitespace-nowrap">
                  {t("coform.selection.note", "Note")} / {parsed.noteMax}
                </th>
              </tr>
            </thead>
            <tbody>
              {parsed.criteria.map((critere) => {
                const note = toNote(mesNotes[critere.fieldKey]);
                const valeur = critere.isFree
                  ? ""
                  : formatCriterionValue(critere.fieldKey, depositAnswers?.[critere.fieldKey]);
                return (
                  <tr key={critere.fieldKey} className="border-b border-border/60 align-top">
                    <td className="py-2.5 pr-3">
                      <span className="font-medium">{critere.label}</span>
                      {critere.coeff !== 1 && (
                        <span className="ml-2 text-xs text-muted-foreground whitespace-nowrap">
                          ×{critere.coeff}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground whitespace-pre-line">
                      {valeur}
                    </td>
                    <td className="py-2.5 pl-3">
                      {parsed.voteType === "starCriterionBased" ? (
                        <StarRating
                          note={note}
                          max={parsed.noteMax}
                          disabled={disabled}
                          label={critere.label}
                          onRate={(n) => noter(critere, n)}
                        />
                      ) : (
                        <>
                          {/* Ni `min`, ni `max`, et `step="any"` : ce champ vit
                              DANS le `<form>` de l'étape (sans `noValidate`), et
                              une contrainte native non satisfaite bloque la
                              soumission du wizard — « Suivant » ne répond plus,
                              sans message. Sans `step`, le pas natif vaut 1 et
                              « 3,7 » bloquerait de même. Le barème est vérifié
                              ici, et le refus s'affiche. */}
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            defaultValue={note || ""}
                            disabled={disabled}
                            aria-label={critere.label}
                            aria-invalid={refus[critere.fieldKey] || undefined}
                            aria-describedby={
                              refus[critere.fieldKey] ? `${idRefus}-${critere.fieldKey}` : undefined
                            }
                            className="w-24 h-8"
                            // Écriture au blur, comme le legacy : on ne veut pas
                            // un appel réseau à chaque frappe.
                            onBlur={(e) => {
                              const saisie = e.target.value.trim();
                              if (saisie === "") return;
                              const n = toNote(saisie);
                              if (n === note) return;
                              if (!estDansLeBareme(n)) {
                                // Refus VISIBLE : message, et retour à la note
                                // réelle — le DOM ne doit pas afficher une note
                                // qui n'existe nulle part.
                                e.target.value = note ? String(note) : "";
                                setRefus((prev) => ({ ...prev, [critere.fieldKey]: true }));
                                return;
                              }
                              if (refus[critere.fieldKey]) {
                                setRefus((prev) => ({ ...prev, [critere.fieldKey]: false }));
                              }
                              noter(critere, n);
                            }}
                          />
                          {refus[critere.fieldKey] && (
                            <p
                              id={`${idRefus}-${critere.fieldKey}`}
                              role="alert"
                              className="mt-1 text-xs text-destructive"
                            >
                              {t(
                                "coform.selection.noteOutOfRange",
                                "La note doit être comprise entre 0 et {{max}}",
                                { max: parsed.noteMax }
                              )}
                            </p>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-b border-border/60">
                <td />
                <td className="py-2.5 px-3 font-semibold">
                  {t("coform.selection.myMean", "Mon évaluation")}
                </td>
                <td className="py-2.5 pl-3 font-semibold tabular-nums">
                  {formatMean(means.myMean)}
                </td>
              </tr>
              <tr>
                <td />
                <td className="py-2.5 px-3 font-semibold">
                  {t("coform.selection.allMean", "Tous les évaluateurs")}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {t("coform.selection.evaluatorCount", "({{count}})", {
                      count: means.evaluatorCount,
                    })}
                  </span>
                </td>
                <td className="py-2.5 pl-3 font-semibold tabular-nums">
                  {formatMean(means.allMean)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {parsed.showAdmissibility && !disabled && (
        <fieldset className="pt-2">
          <legend className="text-sm font-semibold mb-2">
            {t("coform.selection.admissibility", "Admissibilité")}
          </legend>
          <div
            className="flex items-center gap-2"
            role="radiogroup"
            aria-label={t("coform.selection.admissibility", "Admissibilité")}
          >
            {(["admissible", "inadmissible"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={monAvis === v}
                onClick={() =>
                  currentUserId &&
                  saveAdmissibility.mutate(
                    { subFormId, userId: currentUserId, value: v },
                    { onSuccess: (_d, vars) => echoAvis.noter("avis", vars.value) }
                  )
                }
                className={cn(
                  "px-4 py-1.5 rounded-md border text-sm font-medium transition-colors cursor-pointer",
                  monAvis === v
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:bg-muted"
                )}
              >
                {v === "admissible"
                  ? t("coform.selection.admissible", "Admissible")
                  : t("coform.selection.inadmissible", "Non admissible")}
              </button>
            ))}
          </div>
          {/* `admissibility` porte aussi `instruction` et `rejected`, posés par
              d'autres écrans (26 réponses). On les affiche au lieu de laisser
              croire, comme le legacy, que l'avis est « non admissible ». */}
          {monAvis !== undefined && monAvis !== "admissible" && monAvis !== "inadmissible" && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("coform.selection.otherStatus", "Avis actuel : {{value}}", {
                value: String(monAvis),
              })}
            </p>
          )}
        </fieldset>
      )}
    </div>
  );
}
