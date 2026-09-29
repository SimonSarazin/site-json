/**
 * Garde de SOUMISSION « doublon quasi certain » des modales de création — second consommateur du
 * bloc `duplicateCheck` (le premier est le slot `slot:entityDuplicates`, qui alerte pendant la
 * saisie). Quand le nom ET le code postal saisis sont ceux d'une entité existante, la création
 * demande confirmation. Elle ne bloque jamais : l'utilisateur confirme et crée.
 *
 * Vit dans `EntityFormModal`, pas dans le slot : en wizard le slot de l'étape « nom » est démonté
 * à la dernière étape, et il peut l'avoir été avant que le debounce du nom FINAL ait cherché. La
 * décision se prend donc sur les valeurs soumises, par une recherche dédiée.
 *
 * Usage :
 *   const dup = useDuplicateSubmitGuard(effMode === "add" ? config.duplicateCheck : undefined);
 *   const onSubmit = async (values) => { if (await dup.intercept(values, () => commit(values))) return; await commit(values); };
 *   <GenericForm submitting={mutation.isPending || dup.checking} />  {dup.confirmDialog}
 */
import { useRef, useState, type ReactNode } from "react";
import type { SearchEntity } from "@communecter/cocolight-api-client";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useCocolight } from "@/hooks/useCocolight";
import { useSite } from "@/hooks/useSite";
import { useT } from "@/hooks/useT";
import { buildSearchPayload } from "@/modules/search/lib/buildSearchPayload";

import { buildDuplicateBaseParams, toSearchTerm } from "../lib/duplicateSearch";
import {
  DUPLICATE_MIN_CHARS,
  candidatePlace,
  isSearchableName,
  rankDuplicates,
  strongestDuplicate,
  type DuplicateCandidate,
} from "../lib/entityDuplicates";
import type { DuplicateCheckSpec } from "./entityModalSpec";

export interface DuplicateSubmitGuard {
  /** Recherche de vérification en cours : le bouton de soumission doit rester désactivé (une
   *  attente avant la mutation laisserait sinon passer un second clic, donc une double création). */
  checking: boolean;
  /**
   * `true` = la soumission est PRISE EN CHARGE par la garde (confirmation ouverte ; `proceed` sera
   * appelé si l'utilisateur confirme) — l'appelant s'arrête. `false` = rien à confirmer, l'appelant
   * poursuit lui-même.
   */
  intercept: (values: Record<string, unknown>, proceed: () => Promise<void>) => Promise<boolean>;
  confirmDialog: ReactNode;
}

export function useDuplicateSubmitGuard(params: DuplicateCheckSpec | undefined): DuplicateSubmitGuard {
  const t = useT("modules/profil");
  const { entity } = useCocolight();
  const { config } = useSite();
  const [checking, setChecking] = useState(false);
  const [pending, setPending] = useState<DuplicateCandidate | null>(null);
  // La création à relancer si l'utilisateur confirme. Ref : ce n'est pas un état de rendu.
  const proceedRef = useRef<(() => Promise<void>) | null>(null);

  const intercept: DuplicateSubmitGuard["intercept"] = async (values, proceed) => {
    if (!params?.confirmOnSubmit || !params.postalCodeField || !entity) return false;
    const name = values[params.nameField];
    const postalCode = values[params.postalCodeField];
    if (!isSearchableName(name, params.minChars ?? DUPLICATE_MIN_CHARS)) return false;
    const baseParams = buildDuplicateBaseParams(params.search, config, params.fetchLimit);
    if (!baseParams) return false;

    setChecking(true);
    try {
      const payload = buildSearchPayload(baseParams, {
        name: toSearchTerm(name),
        type: baseParams.defaultTypes,
        indexStep: baseParams.indexStepList,
      });
      const page = await entity.searchCostum(payload);
      const found: SearchEntity[] = page?.results ?? [];
      const strong = strongestDuplicate(rankDuplicates({ name, postalCode }, found, { limit: Number.MAX_SAFE_INTEGER }));
      if (!strong) return false;
      proceedRef.current = proceed;
      setPending(strong.candidate);
      return true;
    } catch (error) {
      // Alerte NON bloquante : une vérification qui échoue (réseau) ne doit pas empêcher de créer.
      console.warn("[useDuplicateSubmitGuard] vérification des doublons en échec — création poursuivie.", error);
      return false;
    } finally {
      setChecking(false);
    }
  };

  // La boîte se ferme dès le clic (le bouton d'action d'un AlertDialog ferme toujours) : pendant la
  // création, c'est le bouton de soumission du formulaire qui porte l'état d'attente.
  const dismiss = () => {
    setPending(null);
    proceedRef.current = null;
  };
  const confirm = () => {
    const proceed = proceedRef.current;
    dismiss();
    // Hors du `handleSubmit` du formulaire : le rejet doit être capturé ICI. Le toast d'erreur est
    // déjà émis par la mutation ; la modale reste ouverte, comme sur un échec de soumission normal.
    if (proceed) void proceed().catch(() => undefined);
  };

  const confirmDialog = (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(open) => { if (!open) dismiss(); }}
      onConfirm={confirm}
      title={t("EntityDuplicates.confirm.title")}
      description={t("EntityDuplicates.confirm.description", undefined, {
        name: pending?.name ?? "",
        place: (pending && candidatePlace(pending)) || t("EntityDuplicates.placeUnknown"),
      })}
      confirmLabel={t("EntityDuplicates.confirm.create")}
      cancelLabel={t("EntityDuplicates.confirm.cancel")}
    />
  );

  return { checking, intercept, confirmDialog };
}
