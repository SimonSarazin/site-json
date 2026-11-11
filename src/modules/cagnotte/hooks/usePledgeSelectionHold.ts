import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Pledge } from "@/modules/cagnotte/types";
import { useDocumentHidden } from "@/hooks/useReducedMotion";
import { CAGNOTTE_QUERY_KEYS } from "@/modules/cagnotte/constants/queryKeys";
import { useFundingEnvelopeAction } from "@/modules/cagnotte/hooks/useFundingEnvelopeAction";
import { cleDepense } from "@/modules/cagnotte/utils/commande";
import { asRecord, toArrayOrValues, toString } from "@/modules/cagnotte/utils/coerce";
import { notifyPledgeChange } from "@/modules/cagnotte/utils/pledgeChanges";
import { getPledgeHolder } from "@/modules/cagnotte/utils/pledgeHolder";

const HOLD_REFUSALS = ["heldByOther", "paymentInProgress", "retracted", "notAllowed"] as const;

/** Raison d'un refus de réservation renvoyée par `pledgeSelection`. */
export type PledgeHoldRefusal = (typeof HOLD_REFUSALS)[number];

/** Une raison inconnue compte comme `paymentInProgress`. */
function toHoldRefusal(reason: unknown): PledgeHoldRefusal {
  return HOLD_REFUSALS.find((known) => known === reason) ?? "paymentInProgress";
}

const SELECTION_DEBOUNCE_MS = 300;
const SELECTION_HEARTBEAT_MS = 5 * 60 * 1000;
const EMPTY_SELECTION = "[]";

interface UsePledgeSelectionHoldParams {
  enabled: boolean;
  /** La modale est ouverte : sa fermeture lève les réservations. */
  open: boolean;
  /** Promesses cochées. */
  selected: Pledge[];
  /** Promesses refusées, par `finkey`. */
  onRefused: (refusals: Map<string, PledgeHoldRefusal>) => void;
}

/**
 * Réserve côté serveur les promesses cochées (`pledgeSelection`) au nom de l'onglet : sélection complète envoyée
 * 300 ms après chaque changement, renouvelée toutes les 5 min page visible, levée à la fermeture. `flush` envoie
 * la sélection en attente et attend la dernière réponse.
 */
export function usePledgeSelectionHold({ enabled, open, selected, onRefused }: UsePledgeSelectionHoldParams) {
  const submit = useFundingEnvelopeAction();
  const queryClient = useQueryClient();
  const visible = !useDocumentHidden();
  const latest = useRef({ submit, queryClient, onRefused });
  useEffect(() => {
    latest.current = { submit, queryClient, onRefused };
  });
  const active = enabled && open;
  const pendingRef = useRef<{ timer: ReturnType<typeof setTimeout>; push: () => Promise<void> } | null>(null);
  const lastPushRef = useRef<Promise<void>>(Promise.resolve());
  // Dernière sélection envoyée : à l'ouverture, le serveur ne tient rien pour l'onglet.
  const sentKeyRef = useRef(EMPTY_SELECTION);
  const wasHiddenRef = useRef(false);
  const selectionKey = useMemo(
    () =>
      JSON.stringify(
        selected
          .filter((pledge) => pledge.finkey && pledge.resourceId)
          .map((pledge) => ({
            answerId: pledge.resourceId,
            depenseKey: cleDepense(pledge),
            financerId: pledge.financerId,
            finkey: pledge.finkey,
          })),
      ),
    [selected],
  );

  /**
   * Envoie la sélection `key` (JSON) après l'envoi précédent ; `changed` prévient les autres onglets. Rend les
   * refus par `finkey`.
   */
  const send = useCallback((key: string, changed: boolean) => {
    const { submit, queryClient } = latest.current;
    sentKeyRef.current = key;
    const request = lastPushRef.current
      .then(() => submit("pledgeSelection", { selection: JSON.parse(key), holder: getPledgeHolder() }))
      .then((response) => {
        const refusals = new Map<string, PledgeHoldRefusal>();
        toArrayOrValues<unknown>(response.refused)
          .map(asRecord)
          .filter((refusal) => toString(refusal.finkey) !== "")
          .forEach((refusal) => refusals.set(toString(refusal.finkey), toHoldRefusal(refusal.reason)));
        return refusals;
      })
      // Échec ignoré : le serveur revérifie au paiement et au retrait.
      .catch(() => new Map<string, PledgeHoldRefusal>())
      .finally(() => {
        void queryClient.invalidateQueries({ queryKey: CAGNOTTE_QUERY_KEYS.PLEDGES_IN_PROGRESS_PREFIX() });
        if (changed) notifyPledgeChange();
      });
    lastPushRef.current = request.then(() => undefined);
    return request;
  }, []);

  const push = useCallback(
    (key: string, changed: boolean) =>
      send(key, changed).then((refusals) => {
        if (refusals.size > 0) latest.current.onRefused(refusals);
      }),
    [send],
  );

  // Un changement de sélection part après 300 ms, page visible ou non.
  useEffect(() => {
    if (!active || selectionKey === sentKeyRef.current) return;
    const run = () => push(selectionKey, true);
    const timer = setTimeout(() => {
      pendingRef.current = null;
      void run();
    }, SELECTION_DEBOUNCE_MS);
    pendingRef.current = { timer, push: run };
    return () => {
      clearTimeout(timer);
      if (pendingRef.current?.timer === timer) pendingRef.current = null;
    };
  }, [active, selectionKey, push]);

  // Renouvellement page visible seulement ; au retour, la sélection repart une fois.
  useEffect(() => {
    if (!active) return;
    if (!visible) {
      wasHiddenRef.current = true;
      return;
    }
    const empty = selectionKey === EMPTY_SELECTION;
    if (wasHiddenRef.current && !empty) void push(selectionKey, false);
    wasHiddenRef.current = false;
    if (empty) return;
    const heartbeat = setInterval(() => void push(selectionKey, false), SELECTION_HEARTBEAT_MS);
    return () => clearInterval(heartbeat);
  }, [active, selectionKey, visible, push]);

  // Fermeture : levée de ce que l'onglet a envoyé, s'il a envoyé quelque chose.
  useEffect(() => {
    if (!active) return;
    return () => {
      if (sentKeyRef.current !== EMPTY_SELECTION) void send(EMPTY_SELECTION, true);
    };
  }, [active, send]);

  const flush = useCallback(async () => {
    const pending = pendingRef.current;
    if (pending) {
      clearTimeout(pending.timer);
      pendingRef.current = null;
      await pending.push();
      return;
    }
    await lastPushRef.current;
  }, []);

  return { flush };
}
