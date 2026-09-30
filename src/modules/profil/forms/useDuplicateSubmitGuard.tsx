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
 *   const dup = useDuplicateSubmitGuard(effMode === "add" ? config.duplicateCheck : undefined, open);
 *   const onSubmit = async (values) => { if (await dup.intercept(values, () => commit(values))) return; await commit(values); };
 *   <GenericForm submitting={mutation.isPending || dup.checking} />  {dup.confirmDialog}
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
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

/**
 * Pages lues avant de conclure. Le serveur trie par date de mise à jour : sur un nom générique
 * (plus de 50 fiches), un homonyme exact ANCIEN tombe hors de la première page. La soumission
 * n'arrive qu'une fois : elle peut se permettre trois requêtes, l'alerte de saisie non.
 */
const MAX_PAGES = 3;

export interface DuplicateSubmitGuard {
  /** Recherche de vérification en cours : le bouton de soumission doit rester désactivé (une
   *  attente avant la mutation laisserait sinon passer un second clic, donc une double création). */
  checking: boolean;
  /**
   * `true` = la soumission est PRISE EN CHARGE par la garde — l'appelant s'arrête : soit la
   * confirmation est ouverte (`proceed` sera appelé si l'utilisateur confirme), soit la modale a été
   * fermée pendant la vérification et la soumission est abandonnée. `false` = rien à confirmer,
   * l'appelant poursuit lui-même.
   */
  intercept: (values: Record<string, unknown>, proceed: () => Promise<void>) => Promise<boolean>;
  confirmDialog: ReactNode;
}

/**
 * @param params bloc `duplicateCheck` du formulaire ; `undefined` = garde inerte (édition, formulaire non concerné)
 * @param open   la modale hôte est ouverte — elle reste MONTÉE une fois fermée, la garde doit donc savoir
 *               qu'une vérification en vol ne concerne plus personne
 */
export function useDuplicateSubmitGuard(params: DuplicateCheckSpec | undefined, open: boolean): DuplicateSubmitGuard {
  const t = useT("modules/profil");
  const { entity } = useCocolight();
  const { config } = useSite();
  const [checking, setChecking] = useState(false);
  // `candidate` reste affichée pendant l'animation de fermeture de la boîte : la vider à la
  // fermeture ferait disparaître le nom du texte sous les yeux de l'utilisateur.
  const [confirmation, setConfirmation] = useState<{ candidate: DuplicateCandidate; open: boolean } | null>(null);
  // Ce qui n'est pas un état de rendu : la création à relancer, le bouton à refocaliser, et le
  // numéro de la soumission en cours (changé à la fermeture de la modale : une réponse qui arrive
  // après ne doit ni ouvrir une confirmation sur une page vide, ni créer une fiche abandonnée).
  const proceedRef = useRef<(() => Promise<void>) | null>(null);
  const focusRef = useRef<HTMLElement | null>(null);
  const runRef = useRef(0);

  useEffect(() => {
    if (open) return;
    runRef.current += 1;
    proceedRef.current = null;
  }, [open]);
  // État ajusté au rendu plutôt que dans l'effet : pas de rendu intermédiaire avec la boîte ouverte.
  if (!open && confirmation?.open) setConfirmation({ ...confirmation, open: false });

  const intercept: DuplicateSubmitGuard["intercept"] = async (values, proceed) => {
    if (!params?.confirmOnSubmit || !params.postalCodeField || !entity) return false;
    const name = values[params.nameField];
    const postalCode = values[params.postalCodeField];
    if (!isSearchableName(name, params.minChars ?? DUPLICATE_MIN_CHARS)) return false;
    const baseParams = buildDuplicateBaseParams(params.search, config, params.fetchLimit);
    if (!baseParams) return false;

    const run = runRef.current;
    // Le bouton de soumission va être désactivé (`checking`) et perdre le focus : on retient où il était.
    focusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setChecking(true);
    try {
      const payload = buildSearchPayload(baseParams, {
        name: toSearchTerm(name),
        type: baseParams.defaultTypes,
        indexStep: baseParams.indexStepList,
      });
      let page = await entity.searchCostum(payload);
      const found: SearchEntity[] = [...(page?.results ?? [])];
      for (let read = 1; read < MAX_PAGES && page?.hasNext && typeof page.next === "function"; read += 1) {
        page = await page.next();
        found.push(...(page?.results ?? []));
      }
      if (run !== runRef.current) return true; // modale fermée entre-temps : soumission abandonnée
      const strong = strongestDuplicate(rankDuplicates({ name, postalCode }, found, { limit: Number.MAX_SAFE_INTEGER }));
      if (!strong) return false;
      proceedRef.current = proceed;
      setConfirmation({ candidate: strong.candidate, open: true });
      return true;
    } catch (error) {
      if (run !== runRef.current) return true;
      // Alerte NON bloquante : une vérification qui échoue (réseau) ne doit pas empêcher de créer.
      console.warn("[useDuplicateSubmitGuard] vérification des doublons en échec — création poursuivie.", error);
      return false;
    } finally {
      setChecking(false);
    }
  };

  // La boîte se ferme dès le clic (le bouton d'action d'un AlertDialog ferme toujours) : pendant la
  // création, c'est le bouton de soumission du formulaire qui porte l'état d'attente.
  const close = () => setConfirmation((current) => (current ? { ...current, open: false } : current));
  const cancel = () => {
    close();
    proceedRef.current = null;
    // Boîte sans déclencheur connu de Radix : le focus retomberait sur <body>.
    const target = focusRef.current;
    requestAnimationFrame(() => { if (target?.isConnected && !target.hasAttribute("disabled")) target.focus(); });
  };
  const confirm = () => {
    const proceed = proceedRef.current;
    proceedRef.current = null;
    close();
    // Hors du `handleSubmit` du formulaire : le rejet doit être capturé ICI. Le toast d'erreur est
    // déjà émis par la mutation ; la modale reste ouverte, comme sur un échec de soumission normal.
    if (proceed) void proceed().catch(() => undefined);
  };

  const candidate = confirmation?.candidate;
  const confirmDialog = (
    <ConfirmDialog
      open={confirmation?.open ?? false}
      // `proceedRef` vidé = l'utilisateur vient de confirmer : la fermeture qui suit n'est pas une annulation.
      onOpenChange={(next) => { if (!next && proceedRef.current) cancel(); }}
      onConfirm={confirm}
      title={t("EntityDuplicates.confirm.title")}
      description={t("EntityDuplicates.confirm.description", undefined, {
        name: candidate?.name ?? "",
        place: (candidate && candidatePlace(candidate)) || t("EntityDuplicates.placeUnknown"),
      })}
      confirmLabel={t("EntityDuplicates.confirm.create")}
      cancelLabel={t("EntityDuplicates.confirm.cancel")}
    />
  );

  return { checking, intercept, confirmDialog };
}
