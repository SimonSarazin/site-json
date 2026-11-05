import { useCallback, useMemo, useState } from "react";
import type { QueryKey } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { isUser } from "@/lib/getTypedEntity";
import type { CagnotteFundableItem } from "@/modules/cagnotte/types";
import type { RetractPledgeRequest } from "@/modules/cagnotte/components/parts/RetractPledgeDialog";
import { usePledgeRetractionEnabled } from "@/modules/cagnotte/hooks/usePledgeRetractionEnabled";
import { usePledgesInProgress } from "@/modules/cagnotte/hooks/usePledgesInProgress";
import { useUserAdminOrganizations } from "@/modules/cagnotte/hooks/useUserAdminOrganizations";
import { asRecord, toArrayOrValues } from "@/modules/cagnotte/utils/coerce";
import { DEFAULT_AAC_STEP, toNumber, toString } from "@/modules/cagnotte/utils/dataTransform";
import { resolveDepenseKey } from "@/modules/cagnotte/utils/depenseKey";
import {
  findPledgeLine,
  isOwnPledgeLine,
  isRetractablePledgeLine,
  readDepensesInProgress,
  readPledgesInProgress,
} from "@/modules/cagnotte/utils/pledgeRetraction";
import { AAC_QUERY_KEYS } from "@/modules/aac/constants/queryKeys";
import { COMMUN_ANSWER_PREFIX } from "@/modules/aac/prefetch/prefetchCommun";

type FundingLine = CagnotteFundableItem["allFunding"][number];

/** Une ligne que l'utilisateur pourrait retirer, et si un paiement en cours l'en empêche pour l'instant. */
export interface PledgeLineRetraction {
  request: RetractPledgeRequest;
  paymentInProgress: boolean;
}

interface UseCommunPledgeRetractionParams {
  answerId: string;
  /** `answers.<step>.depense` tel que le document le porte. */
  depensesDocument: unknown;
  depenseStepKey?: string | null;
  /** Porteur du commun, admin du projet lié ou de son organisation parente. */
  isCommunAdmin: boolean;
  isConnected: boolean;
  currentUserId?: string;
  /** Enveloppe du commun : ses paiements en cours servent tant que la relecture n'a pas répondu, ou sans elle. */
  inProgressFallback: unknown;
}

/** L'utilisateur finance-t-il une promesse retirable de ces dépenses (lui-même ou une organisation administrée) ? */
function hasOwnRetractableLine(depenses: unknown, userId: string | undefined, adminOrgIds: readonly string[]): boolean {
  return toArrayOrValues<unknown>(depenses).some((depense) =>
    toArrayOrValues<unknown>(asRecord(depense).financer).some(
      (line) => isRetractablePledgeLine(line) && isOwnPledgeLine(line, userId, adminOrgIds),
    ),
  );
}

/**
 * Retrait des promesses depuis la fiche commun (étape `aapStep1`, seule lue par le serveur) : ligne relue dans le
 * document brut, bouton pour le financeur (soi ou organisation administrée) ou l'admin du commun. Paiements en cours
 * relus pour eux seuls (`usePledgesInProgress`), lus dans l'enveloppe sinon.
 */
export function useCommunPledgeRetraction({
  answerId,
  depensesDocument,
  depenseStepKey,
  isCommunAdmin,
  isConnected,
  currentUserId,
  inProgressFallback,
}: UseCommunPledgeRetractionParams) {
  const enabled = usePledgeRetractionEnabled();
  const { me } = useCocolight();
  const active = enabled && isConnected && !!answerId && (depenseStepKey ?? DEFAULT_AAC_STEP) === DEFAULT_AAC_STEP;
  const adminOrganizations = useUserAdminOrganizations(active && me && isUser(me) ? me : null, {});
  const adminOrgIds = useMemo(() => adminOrganizations.map((organization) => organization.id), [adminOrganizations]);
  const [request, setRequest] = useState<RetractPledgeRequest | null>(null);

  const watch = active && (isCommunAdmin || hasOwnRetractableLine(depensesDocument, currentUserId, adminOrgIds));
  const live = usePledgesInProgress(answerId ? [answerId] : [], { enabled: watch });
  const inProgressSource = live ?? inProgressFallback;
  const isPaymentInProgress = useMemo(() => readPledgesInProgress(inProgressSource), [inProgressSource]);
  const isDepenseInProgress = useMemo(() => readDepensesInProgress(inProgressSource), [inProgressSource]);

  /** Le retrait d'une ligne affichée, ou `null` si elle ne se retire pas. */
  const stateFor = useCallback(
    (fund: FundingLine, depenseName: string): PledgeLineRetraction | null => {
      if (!active || !fund.finkey || !fund.financerId) return null;
      const match = findPledgeLine(depensesDocument, fund.finkey, fund.financerId);
      if (!match || !isRetractablePledgeLine(match.line)) return null;
      if (!isCommunAdmin && !isOwnPledgeLine(match.line, currentUserId, adminOrgIds)) return null;
      return {
        request: {
          answerId,
          depenseKey: match.depenseKey,
          financerId: fund.financerId,
          finkey: fund.finkey,
          financerName: fund.financerName || toString(match.line.name),
          amount: toNumber(match.line.amount),
          depenseName,
        },
        paymentInProgress: isPaymentInProgress(answerId, fund.finkey),
      };
    },
    [active, depensesDocument, isCommunAdmin, currentUserId, adminOrgIds, answerId, isPaymentInProgress],
  );

  /** Une contribution est-elle en cours sur ce palier ? Sa suppression attend alors l'issue du paiement. */
  const depenseInProgress = useCallback(
    (item: CagnotteFundableItem): boolean =>
      !!answerId &&
      isDepenseInProgress(
        answerId,
        String(item.milestoneId ?? ""),
        item.depenseKey ?? resolveDepenseKey(depensesDocument, item.depenseIndex),
      ),
    [answerId, isDepenseInProgress, depensesDocument],
  );

  const extraInvalidate = useMemo<QueryKey[]>(
    () => [COMMUN_ANSWER_PREFIX(answerId), AAC_QUERY_KEYS.COMMUNS_PREFIX()],
    [answerId],
  );

  return {
    stateFor,
    depenseInProgress,
    /** Le palier en cours de financement s'affiche « Paiement en cours » (clé du site). */
    showDepenseProgress: enabled,
    request,
    open: setRequest,
    close: useCallback(() => setRequest(null), []),
    extraInvalidate,
  };
}
