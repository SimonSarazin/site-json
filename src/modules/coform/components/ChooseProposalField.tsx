import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useCocolightOptional } from "@/hooks/useCocolight";
import { useEcrituresLocales } from "../hooks/useEcrituresLocales";
import { useSaveChooseProposal } from "../actions/mutations/selection";
import {
  isSelectedIn,
  getOtherSelections,
  getStoredContextName,
  buildChooseEntry,
  SELECTED,
  type ChooseProposalValue,
} from "../utils/chooseProposal";
import { FieldLabel } from "./FormFields";
import type { FormFieldMapping } from "../types";

/**
 * `tpls.forms.aap.chooseProposal` — « sélectionné pour l'afficher dans l'annuaire ».
 *
 * Comme ses voisins : hors RHF, hors schéma Zod, écriture par chemin ciblé. La
 * particularité est le SCOPE : la valeur est indexée par CONTEXTE (le costum),
 * pas par évaluateur. Le choix ne vaut donc que pour le costum courant, et
 * l'écriture ne doit surtout pas toucher aux autres — 9 des 59 réponses en base
 * portent 2 ou 3 contextes.
 */

export interface ChooseProposalFieldProps {
  field: FormFieldMapping;
  subFormId: string;
  formId?: string | null;
  value?: ChooseProposalValue | null;
  answerId?: string;
  readOnly?: boolean;
}

export function ChooseProposalField({
  field,
  subFormId,
  formId,
  value,
  answerId,
  readOnly,
}: ChooseProposalFieldProps) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");
  const cocolight = useCocolightOptional();

  const save = useSaveChooseProposal({
    api: cocolight?.api ?? null,
    formId: formId ?? "",
    answerId,
  });
  // Le formulaire ne resynchronise pas son instantané : sans ça, le bouton reste
  // sur l'ancien choix alors que l'enregistrement a réussi. Cf. `useEcrituresLocales`.
  const echo = useEcrituresLocales<boolean>();

  const contextId = cocolight?.contextId ?? null;
  const entite = cocolight?.entity as { name?: string } | null | undefined;

  // Sans réponse enregistrée, rien à cibler (cf. `SelectionField`). Sans contexte
  // identifié, on ne saurait PAS sous quelle clé écrire : mieux vaut ne rien
  // afficher que d'écrire au mauvais endroit — la valeur est justement ce qui
  // décide de la publication dans l'annuaire.
  if (!answerId || !contextId) return null;

  const disabled = Boolean(readOnly);
  const selectionne = echo.lire(contextId, isSelectedIn(value, contextId));
  const autres = getOtherSelections(value, contextId);
  const nomContexte =
    entite?.name ?? getStoredContextName(value, contextId) ?? null;

  const choisir = (selected: boolean) => {
    if (disabled || selected === selectionne) return;
    save.mutate(
      {
        subFormId,
        contextId,
        entry: buildChooseEntry(
          { id: contextId, type: cocolight?.contextType ?? null, name: nomContexte },
          selected
        ),
      },
      // Après le serveur, jamais avant : un échec doit laisser le bouton sur la
      // valeur réelle, pas sur celle qu'on espérait.
      { onSuccess: (_d, vars) => echo.noter(vars.contextId, vars.entry.value === SELECTED) }
    );
  };

  return (
    <div className={cn("space-y-2", field.width || "col-span-12")}>
      <FieldLabel field={field} />

      {/* Structure reprise du legacy (`aap/chooseProposal.php`) : une carte
          portant deux options côte à côte, pastille radio puis libellé, couleur
          pleine sur le choix actif. Les dimensions legacy (carte 400px/11rem,
          options de 5.5rem, libellé 20px) sont volontairement NON reprises :
          à cette échelle le widget écrasait le reste du formulaire pour une
          simple question fermée. Les couleurs passent par les tokens
          (`primary` / `destructive`) au lieu du `var(--clr_var)` / `#cd1616`
          en dur, pour suivre le costum et le mode sombre. */}
      <div className="w-fit rounded-md border bg-card p-2.5 shadow-sm">
        <div
          className="flex items-center gap-2"
          role="radiogroup"
          aria-label={field.label || t("coform.chooseProposal.legend", "Publication dans l'annuaire")}
        >
          {[true, false].map((v) => {
            const actif = selectionne === v;
            return (
              <button
                key={String(v)}
                type="button"
                role="radio"
                aria-checked={actif}
                disabled={disabled}
                onClick={() => choisir(v)}
                className={cn(
                  "flex h-10 min-w-28 items-center justify-center gap-2.5 rounded-md border px-4 text-sm font-medium transition-colors",
                  disabled ? "cursor-default" : "cursor-pointer",
                  actif && v && "border-primary bg-primary text-primary-foreground",
                  actif && !v && "border-destructive bg-destructive text-destructive-foreground",
                  !actif && "border-border bg-card text-muted-foreground",
                  !actif && !disabled && "hover:border-muted-foreground/40"
                )}
              >
                {/* Pastille : grise au repos, blanche à point coloré une fois
                    cochée. Le point intérieur est centré par flex plutôt que
                    positionné au pixel — pas d'arithmétique à refaire si la
                    taille de la pastille change. */}
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors",
                    actif ? "bg-background" : "bg-muted-foreground/30"
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full transition-all duration-200",
                      actif ? "scale-100 opacity-100" : "scale-150 opacity-0",
                      v ? "bg-primary" : "bg-destructive"
                    )}
                  />
                </span>
                {v ? t("coform.chooseProposal.yes", "Oui") : t("coform.chooseProposal.no", "Non")}
              </button>
            );
          })}
        </div>

        {/* Le legacy n'affiche le contexte QUE sur « Oui » (il masque la ligne
            sinon) : sur « Non » il n'y a pas de publication à rattacher. */}
        {selectionne && nomContexte && (
          <p className="pt-2 text-xs text-muted-foreground">
            {t("coform.chooseProposal.context", "Contexte : {{name}}", { name: nomContexte })}
          </p>
        )}
      </div>

      {/* Le choix ne vaut QUE pour le costum courant : le dire évite de croire
          qu'on publie ou dépublie partout. Le legacy n'affiche que le contexte
          courant, sans jamais mentionner les autres. */}
      {autres.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("coform.chooseProposal.alsoSelected", "Également retenu par : {{names}}", {
            names: autres.map((a) => a.name).join(", "),
          })}
        </p>
      )}
    </div>
  );
}
