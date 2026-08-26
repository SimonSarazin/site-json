import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useCocolightOptional } from "@/hooks/useCocolight";
import { useSaveVote } from "../actions/mutations/selection";
import {
  tallyVotes,
  getMyVote,
  getMinimumVotes,
  POUR,
  NEUTRE,
  CONTRE,
  VOTE_VALUES,
  type VoteValue,
  type PourContreValue,
} from "../utils/pourContre";
import type { FormFieldMapping } from "../types";

/**
 * `tpls.forms.ocecoform.pourContre` — vote simple d'un jury sur une candidature.
 *
 * Même contrat que `SelectionField` : pas de `value`/`onChange` RHF, pas d'entrée
 * au schéma Zod, écriture immédiate par chemin ciblé. La valeur est scopée par
 * évaluateur et le backend remplacerait la clé en bloc à la soumission.
 */

export interface PourContreFieldProps {
  field: FormFieldMapping;
  subFormId: string;
  formId?: string | null;
  value?: PourContreValue | null;
  /** `answer.inputConfig` — porte le seuil de votes attendu. */
  inputConfig?: { pourContre?: { minimumVotes?: unknown } } | null;
  answerId?: string;
  readOnly?: boolean;
}

export function PourContreField({
  field,
  subFormId,
  formId,
  value,
  inputConfig,
  answerId,
  readOnly,
}: PourContreFieldProps) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");
  const cocolight = useCocolightOptional();
  const currentUserId = cocolight?.me?.id ?? null;

  const saveVote = useSaveVote({
    api: cocolight?.api ?? null,
    formId: formId ?? "",
    answerId,
  });

  // Pas de `useMemo` : le décompte parcourt une poignée d'évaluateurs et son
  // résultat n'alimente ni enfant mémoïsé, ni effet, ni queryKey — le mémoïser
  // serait du bruit (norme 14).
  const tally = tallyVotes(value);
  const monVote = getMyVote(value, currentUserId);

  // Même raison que `SelectionField` : l'écriture cible un document existant.
  if (!answerId) return null;

  const disabled = Boolean(readOnly) || !currentUserId;
  const seuil = getMinimumVotes(inputConfig);

  const libelle: Record<VoteValue, string> = {
    [POUR]: t("coform.pourContre.for", "Pour"),
    [NEUTRE]: t("coform.pourContre.neutral", "Neutre"),
    [CONTRE]: t("coform.pourContre.against", "Contre"),
  };

  const voter = (vote: VoteValue) => {
    if (disabled || !currentUserId) return;
    saveVote.mutate({ subFormId, userId: currentUserId, vote });
  };

  return (
    <div className={cn("space-y-4", field.width || "col-span-12")}>
      {field.label && (
        <div className="block text-base font-semibold leading-snug text-foreground">
          {field.label}
        </div>
      )}

      {!disabled && (
        <div>
          {monVote && (
            <p className="text-sm text-muted-foreground mb-2">
              {t("coform.pourContre.thanks", "Merci pour votre vote : {{vote}}", {
                vote: libelle[monVote],
              })}
            </p>
          )}
          <div
            className="flex items-center gap-2"
            role="radiogroup"
            aria-label={t("coform.pourContre.yourVote", "Votre vote")}
          >
            {VOTE_VALUES.map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={monVote === v}
                onClick={() => voter(v)}
                className={cn(
                  "px-4 py-1.5 rounded-md border text-sm font-medium transition-colors cursor-pointer",
                  monVote === v
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:bg-muted"
                )}
              >
                {libelle[v]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {/* Barre des parts. Les trois valeurs somment à 100 (cf. `tallyVotes`) ;
            le legacy, lui, les multipliait par le total et débordait. */}
        <div
          className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={t("coform.pourContre.distribution", "Répartition des votes")}
        >
          <div className="bg-primary" style={{ width: `${tally.pourPct}%` }} />
          <div className="bg-muted-foreground/30" style={{ width: `${tally.neutrePct}%` }} />
          <div className="bg-destructive" style={{ width: `${tally.contrePct}%` }} />
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">
              {t("coform.pourContre.voters", "Votants")}
            </dt>
            <dd className="font-semibold tabular-nums">{tally.total}</dd>
          </div>
          {(
            [
              [POUR, tally.pour, tally.pourPct],
              [NEUTRE, tally.neutre, tally.neutrePct],
              [CONTRE, tally.contre, tally.contrePct],
            ] as const
          ).map(([v, n, pct]) => (
            <div key={v}>
              <dt className="text-muted-foreground">{libelle[v]}</dt>
              <dd className="font-semibold tabular-nums">
                {n} <span className="font-normal text-muted-foreground">({pct}%)</span>
              </dd>
            </div>
          ))}
        </dl>

        {/* Affiché seulement s'il est RÉELLEMENT configuré : le « 50% » du legacy
            est un repli d'échec de lecture, pas un réglage par défaut. */}
        {seuil && (
          <p className="text-xs text-muted-foreground">
            {t("coform.pourContre.minimum", "Seuil attendu : {{value}}", { value: seuil })}
          </p>
        )}
      </div>
    </div>
  );
}
