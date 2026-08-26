import { useState } from "react";
import { Check, Clock, Loader2, Star, StarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { cn } from "@/lib/utils";
import { useSaveChooseProposal } from "@/modules/coform/actions/mutations/selection";
import { buildChooseEntry } from "@/modules/coform/utils/chooseProposal";
import { AAC_QUERY_KEYS } from "../../constants/queryKeys";
import type { Api } from "@communecter/cocolight-api-client";

/**
 * Raccourci « Sélectionner / Désélectionner » de la fiche d'un commun.
 *
 * Sélectionner, c'est publier le commun dans l'annuaire DE CET AAC. Le choix est
 * donc indexé par CONTEXTE — l'organisation porteuse de l'appel — et pas par
 * réponse : un même commun peut être retenu par un appel et pas par un autre.
 * Mesuré en base : 8 réponses du formulaire « Appel à commun des tiers lieux »
 * portent une entrée pour le contexte « Fédération des CAE », ce sont
 * exactement les communs étrangers visibles dans l'annuaire des CAE.
 *
 * ⚠️ `contextId` DOIT être celui de l'annuaire (`useAacDirectoryContext`), qui
 * est l'organisation parente du formulaire de l'AAC — c'est la clé sur laquelle
 * le filtre de l'annuaire porte (`aacQueryParams`). Écrire sous une autre clé
 * (par exemple l'entité du slug du site, ce qu'utilise `ChooseProposalField`)
 * enregistrerait sans erreur un choix que l'annuaire n'irait jamais lire :
 * « j'ai cliqué, rien ne change ».
 *
 * ⚠️ Le gate `isAdmin` est un gate d'AFFICHAGE, pas une sécurité : le backend
 * (`UpdatePathValuedAction`) ne vérifie que la connexion. Cf. BACKLOG.
 */

export interface CommunSelectionControlProps {
  api: Api | null;
  /** Admin de l'AAC courant — seul à voir le bouton. */
  isAdmin: boolean;
  /**
   * `null` ⇒ statut INDÉCIDABLE : aucune question `choose` résolue, ou aucun
   * contexte identifié. Une réponse sans étape d'évaluation n'est PAS ce
   * cas-là — l'absence d'entrée vaut « non sélectionné », donc `false`.
   */
  isSelected: boolean | null;
  /** Organisation porteuse de l'appel. Sans elle, on ne sait pas où écrire. */
  contextId: string | null;
  contextType?: string | null;
  contextName?: string | null;
  /** Étape portant l'input `choose` (résolue par la config, jamais en dur). */
  subFormId: string | null;
  /** Formulaire servant à construire l'entité — celui de la réponse. */
  formId: string | null;
  answerId: string | null;
  onDone?: () => void;
  className?: string;
}

export function CommunSelectionControl({
  api,
  isAdmin,
  isSelected,
  contextId,
  contextType,
  contextName,
  subFormId,
  formId,
  answerId,
  onDone,
  className,
}: CommunSelectionControlProps) {
  useLoadNamespace("modules/aac");
  const t = useT("modules/aac");
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Les invalidations de l'annuaire vivent sur la MUTATION, pas dans le
  // `onSuccess` par appel : React Query saute ces callbacks-là dès que
  // l'observateur n'a plus d'abonné. Un admin qui confirme puis revient à
  // l'annuaire avant la réponse verrait sinon la liste d'avant pendant tout le
  // `staleTime`, alors même que le toast lui annonce l'enregistrement.
  const save = useSaveChooseProposal({
    api,
    formId: formId ?? "",
    answerId: answerId ?? undefined,
    extraInvalidate: [
      AAC_QUERY_KEYS.COMMUNS_PREFIX(),
      AAC_QUERY_KEYS.COUNT_PREFIX(),
      AAC_QUERY_KEYS.FACETS_PREFIX(),
    ],
  });

  // Le badge reste affiché même sans contexte résolu : c'est une lecture, elle
  // ne risque rien. Seule l'ÉCRITURE exige de savoir sous quelle clé écrire.
  const peutAgir = isAdmin && Boolean(contextId) && Boolean(subFormId) && Boolean(answerId);

  if (!peutAgir) {
    return <CommunSelectionBadge isSelected={isSelected} className={className} />;
  }

  const selectionne = isSelected === true;
  const prefixe = selectionne ? "confirmDeselect" : "confirmSelect";

  const confirmer = () => {
    save.mutate(
      {
        subFormId: subFormId as string,
        contextId: contextId as string,
        entry: buildChooseEntry(
          { id: contextId as string, type: contextType ?? null, name: contextName ?? null },
          !selectionne
        ),
      },
      {
        onSuccess: () => {
          setConfirmOpen(false);
          onDone?.();
        },
      }
    );
  };

  return (
    <>
      <Button
        variant={selectionne ? "outline" : "default"}
        size="sm"
        className={cn("gap-2", className)}
        onClick={() => setConfirmOpen(true)}
        disabled={save.isPending}
      >
        {save.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : selectionne ? (
          <StarOff className="size-3.5" />
        ) : (
          <Star className="size-3.5" />
        )}
        {String(t(selectionne ? "detail.selection.deselectCta" : "detail.selection.selectCta"))}
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={confirmer}
        title={String(t(`detail.selection.${prefixe}.title`))}
        // Un contexte SANS nom n'est pas un cas théorique : le legacy écrit
        // `parent[<id>] = {id, type}` sans `name` (`FormTemplate::createFormFromTemplate`),
        // et `moveFormToParent` DÉTRUIT un `name` existant. Le repli « {{name}} »
        // vide produirait « l'annuaire de « » ». On bascule alors sur une phrase
        // sans nom — plutôt que d'exiger `contextName` dans `peutAgir`, ce qui
        // masquerait un bouton dont l'écriture est parfaitement valide.
        description={String(
          contextName
            ? t(`detail.selection.${prefixe}.description`, undefined, { name: contextName })
            : t(`detail.selection.descriptionNoName.${prefixe}`)
        )}
        confirmLabel={String(t(`detail.selection.${prefixe}.confirm`))}
        cancelLabel={String(t("detail.selection.cancel"))}
        // Désélectionner retire le commun de l'annuaire : c'est la branche qui
        // fait disparaître quelque chose, donc la branche destructive.
        isDestructive={selectionne}
        isPending={save.isPending}
      />
    </>
  );
}

/**
 * Statut en lecture seule — ce que voit un non-admin.
 *
 * Forme reprise de la pilule d'`AacCommunRow` (mêmes tokens `accent`) pour que
 * « En attente » se lise pareil dans l'annuaire et sur la fiche.
 *
 * `null` ⇒ rien : on ne sait pas sous quelle clé regarder (pas de question
 * `choose` résolue, ou pas de contexte), et afficher un statut serait une
 * affirmation sans fondement. Une réponse dépourvue d'étape d'évaluation, elle,
 * vaut « En attente » — cf. `parseAacAnswer`.
 */
export function CommunSelectionBadge({
  isSelected,
  className,
}: {
  isSelected: boolean | null;
  className?: string;
}) {
  useLoadNamespace("modules/aac");
  const t = useT("modules/aac");

  if (isSelected === null) return null;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
        // Aplat plein et non `bg-primary/10 text-primary` : à 11 px on est hors
        // du seuil « grand texte », et sur le thème du site AAC ce couple tombe
        // à 4.04:1 — sous les 4.5:1 de WCAG 1.4.3 AA. La paire
        // `primary`/`primary-foreground` est garantie par construction des
        // tokens, contrairement à une teinte à 10 % d'opacité.
        isSelected
          ? "bg-primary text-primary-foreground"
          : "bg-accent/80 text-accent-foreground",
        className
      )}
    >
      {isSelected ? <Check className="size-3" /> : <Clock className="size-3" />}
      {String(t(isSelected ? "detail.selection.selected" : "detail.selection.pending"))}
    </span>
  );
}
