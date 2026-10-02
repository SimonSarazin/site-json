/**
 * Enregistrement des contributions de cagnotte. Le serveur est l'unique auteur des lignes de
 * financement : tout passe par `/co2/aap/coremuoperation/` (`answer.addFinancer`,
 * `answer.payFinancer`), qui génère `finkey`, `invoiceId` et les agrégats de `payment` et
 * vérifie les droits.
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
import { DepenseFunding, Pledge } from "@/modules/cagnotte/types.ts";

interface FinancerData {
  id: string;
  name: string;
  type: string;
}

/**
 * Moyens qui donnent lieu à un versement journalisé. Sans `method`, la contribution est une
 * PROMESSE : elle s'arrête à l'engagement (`status:"pending"`, `payment.logs: []`).
 */
const MOYENS_AVEC_VERSEMENT = new Set(["stripe", "helloasso"]);

/**
 * Comment viser la dépense côté serveur. `milestoneId` d'abord : le serveur résout la clé
 * lui-même (`Aap::findDepenseKeyForMilestone`). Sinon `depenseKey`, lue à la source par
 * `buildResourceFromAnswer`. En dernier repli la position, exacte seulement si `depense` est un
 * vrai tableau (cf. `utils/depenseKey.ts`).
 */
function cibleDepense(funding: DepenseFunding): { milestoneId?: string; depenseKey?: string } {
  if (funding.milestoneId) return { milestoneId: funding.milestoneId };
  if (funding.depenseKey !== undefined && funding.depenseKey !== "") {
    return { depenseKey: funding.depenseKey };
  }
  return { depenseKey: String(funding.depenseIndex) };
}

/** Montant versé pour régler une promesse : son solde, pas le montant engagé. */
export function montantARegler(pledge: Pledge): number {
  return pledge.remainingAmount ?? pledge.fundingAmount;
}

/** Promesses qu'un règlement peut journaliser : rattachées à une ressource, avec un solde positif. */
export function promessesReglables(pledges: Pledge[]): Array<Pledge & { resourceId: string }> {
  return pledges.filter(
      (pledge): pledge is Pledge & { resourceId: string } =>
          typeof pledge.resourceId !== "undefined" && montantARegler(pledge) > 0,
  );
}

export const useSaveCagnotteContribution = () => {
  useLoadNamespace("modules/cagnotte");
  const t = useT("modules/cagnotte");
  const { api, me } = useCocolight();

  /**
   * Enregistre une contribution : un engagement par dépense allouée, suivi du versement si
   * l'argent a été encaissé (`method` absent = promesse).
   *
   * De `financerData`, seul `id` part : le serveur résout `name` et `type` depuis la
   * collection de l'entité. Rend `true` si au moins une dépense a été enregistrée.
   */
  const saveContribution = useCallback(
      async (
          answerOrId: Answer | string,
          depenseFundings: DepenseFunding[],
          financerData: FinancerData,
          method?: string,
          transactionId?: string
      ): Promise<boolean> => {
        try {
          if (!depenseFundings.length) throw new Error(String(t("toasts.errors.noMilestoneFundings")));
          if (!api) throw new Error(String(t("toasts.errors.noApiClient")));
          if (!me?.serverData?.id) throw new Error(String(t("toasts.errors.notLoggedIn")));
          if (!financerData?.id) throw new Error(String(t("toasts.errors.invalidFinancer", undefined, { depenseIndex: "" })));

          const answerIdStr = typeof answerOrId === "string" ? answerOrId : answerOrId.id;
          if (!answerIdStr?.trim()) throw new Error(String(t("toasts.errors.noAnswerId")));

          const answer = typeof answerOrId === "string" ? await api.answer({ id: answerIdStr }) : answerOrId;
          const versementAttendu = Boolean(method && MOYENS_AVEC_VERSEMENT.has(method));

          let successCount = 0;
          const errors: string[] = [];

          // Séquentiel : `addFinancer` fait un read-modify-write sur le tableau
          // `financer` d'une dépense. Deux appels concurrents sur la MÊME dépense
          // s'écraseraient l'un l'autre.
          for (const funding of depenseFundings) {
            if (funding.amount <= 0) continue;

            try {
              const engagement = await answer.addFinancer({
                ...cibleDepense(funding),
                financerId: financerData.id,
                amount: funding.amount,
              });

              // Paiement réellement encaissé : on le journalise sur l'engagement
              // qu'on vient de créer, ciblé par sa `finkey`.
              if (versementAttendu) {
                await answer.payFinancer({
                  depenseKey: engagement.depenseKey,
                  financerId: financerData.id,
                  finkey: engagement.finkey,
                  amount: funding.amount,
                  paymentType: method,
                  transactionId,
                });
              }

              successCount++;
            } catch (error) {
              // Jamais de retry sur `addFinancer` : l'engagement a pu être créé alors que le
              // versement échouait, le rejouer doublonnerait la promesse. Le message serveur
              // est remonté tel quel — seul indice exploitable sur un paiement déjà encaissé.
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

  /**
   * Règle des promesses existantes : un versement par promesse, ciblé par `finkey`, seule clé
   * stable — une insertion concurrente décale les positions. Le montant versé est
   * `remainingAmount`, et non `fundingAmount`, qui surfacturerait une promesse déjà réglée
   * en partie.
   */
  const payContribution = useCallback(
      async (
          pledges: Pledge[],
          method?: string,
          transactionId?: string,
      ): Promise<boolean> => {
        try {
          if (!pledges.length) throw new Error(String(t("toasts.errors.noMilestoneFundings")));
          if (!api) throw new Error(String(t("toasts.errors.noApiClient")));

          // Une seule Answer chargée par ressource, même si plusieurs promesses y pointent.
          const pledgesByResource = new Map<string, Pledge[]>();
          for (const pledge of promessesReglables(pledges)) {
            const group = pledgesByResource.get(pledge.resourceId) ?? [];
            group.push(pledge);
            pledgesByResource.set(pledge.resourceId, group);
          }

          let successCount = 0;
          const errors: string[] = [];

          for (const [resourceId, resourcePledges] of pledgesByResource) {
            const answer = await api.answer({ id: resourceId });

            for (const pledge of resourcePledges) {
              const montant = montantARegler(pledge);

              try {
                await answer.payFinancer({
                  depenseKey: pledge.depenseKey ?? String(pledge.depenseIndex),
                  financerId: pledge.financerId,
                  finkey: pledge.finkey,
                  // Repli pour les promesses antérieures à `finkey`, qui n'en portent pas.
                  finIndex: pledge.finkey ? undefined : pledge.fundingIndex,
                  amount: montant,
                  paymentType: method ?? "manual",
                  transactionId,
                });
                successCount++;
              } catch (error) {
                // Message serveur remonté tel quel : seul indice sur un versement refusé
                // alors que l'argent est déjà parti.
                const detail = error instanceof Error ? error.message : String(error);
                errors.push(`Dépense ${pledge.depenseIndex} : ${detail}`);
                console.error("Versement sur promesse échoué", { pledge, error });
              }
            }
          }

          if (successCount === 0) {
            throw new Error(String(t("toasts.errors.noneSaved", undefined, { reasons: errors.join(" | ") })));
          }

          if (errors.length > 0) {
            showErrorToast(new Error(errors.join(" | ")), "toasts.contributionPartial.title", t,
                { succeeded: String(successCount), total: String(pledges.length) });
          } else {
            showSuccessToast("toasts.contributionSaved.title", t, { count: String(successCount) });
          }

          launchConfettiBurst({ originY: 0.36, spread: 78, count: Math.min(36, 18 + pledges.length * 6) });
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
      [api, t]
  );

  return { saveContribution, payContribution };
};
