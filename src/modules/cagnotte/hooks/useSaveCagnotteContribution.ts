/**
 * Enregistrement des promesses de cagnotte via `answer.addFinancer` (`/co2/aap/coremuoperation/`),
 * qui génère `finkey` et vérifie les droits. Les versements payés sont écrits par le serveur
 * (`fundingEnvelope`).
 *
 * Ne jamais réécrire `depense.N.financer` en direct : une ligne fabriquée côté client n'a pas de
 * `finkey`, et plus rien — versement, validation, doublonnage — ne sait la cibler ensuite.
 * Aucun repli non plus sur `saveCoformAnswer`, qui réécrasait le sous-arbre `answers` entier et
 * pouvait effacer des versements déjà journalisés. Un échec remonte en erreur.
 */

import { useCallback } from "react";
import type { Answer } from "@communecter/cocolight-api-client";
import { showErrorToast, showSuccessToast } from "@/lib/toastUtils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useCocolight } from "@/hooks/useCocolight";
import { launchConfettiBurst } from "@/lib/confetti";
import { DepenseFunding } from "@/modules/cagnotte/types.ts";
import { cibleDepense } from "@/modules/cagnotte/utils/commande";

interface FinancerData {
  id: string;
  name: string;
  type: string;
}

export const useSaveCagnotteContribution = () => {
  useLoadNamespace("modules/cagnotte");
  const t = useT("modules/cagnotte");
  const { api, me } = useCocolight();

  /**
   * Enregistre une promesse : un engagement par dépense allouée, sans versement.
   *
   * De `financerData`, seul `id` part : le serveur résout `name` et `type` depuis la
   * collection de l'entité. Rend `true` si au moins une dépense a été enregistrée.
   */
  const saveContribution = useCallback(
      async (
          answerOrId: Answer | string,
          depenseFundings: DepenseFunding[],
          financerData: FinancerData,
      ): Promise<boolean> => {
        try {
          if (!depenseFundings.length) throw new Error(String(t("toasts.errors.noMilestoneFundings")));
          if (!api) throw new Error(String(t("toasts.errors.noApiClient")));
          if (!me?.serverData?.id) throw new Error(String(t("toasts.errors.notLoggedIn")));
          if (!financerData?.id) throw new Error(String(t("toasts.errors.invalidFinancer", undefined, { depenseIndex: "" })));

          const answerIdStr = typeof answerOrId === "string" ? answerOrId : answerOrId.id;
          if (!answerIdStr?.trim()) throw new Error(String(t("toasts.errors.noAnswerId")));

          const answer = typeof answerOrId === "string" ? await api.answer({ id: answerIdStr }) : answerOrId;

          let successCount = 0;
          const errors: string[] = [];

          // Séquentiel : `addFinancer` fait un read-modify-write sur le tableau
          // `financer` d'une dépense. Deux appels concurrents sur la MÊME dépense
          // s'écraseraient l'un l'autre.
          for (const funding of depenseFundings) {
            if (funding.amount <= 0) continue;

            try {
              await answer.addFinancer({
                ...cibleDepense(funding),
                financerId: financerData.id,
                amount: funding.amount,
              });
              successCount++;
            } catch (error) {
              // Pas de retry : l'engagement a pu être créé malgré l'erreur, le rejouer le doublerait.
              const detail = error instanceof Error ? error.message : String(error);
              errors.push(`Dépense ${funding.depenseIndex} : ${detail}`);
              console.error("Enregistrement du financement échoué", { funding, error });
            }
          }

          if (successCount === 0) {
            throw new Error(String(t("toasts.errors.noneSaved", undefined, { reasons: errors.join(" | ") })));
          }

          if (errors.length > 0) {
            showErrorToast(new Error(errors.join(" | ")), "toasts.contributionPartial.title", t,
                { succeeded: String(successCount), total: String(depenseFundings.length) });
          } else {
            showSuccessToast("toasts.contributionSaved.title", t, { count: String(successCount) });
          }

          launchConfettiBurst({ originY: 0.36, spread: 78, count: Math.min(36, 18 + successCount * 6) });
          return true;
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Erreur inconnue";
          showErrorToast(
              error instanceof Error ? error : new Error(msg),
              "toasts.contributionPartial.title",
              t,
              { reason: msg }
          );
          return false;
        }
      },
      [api, me, t]
  );

  return { saveContribution };
};
