import { Loader2 } from "lucide-react";
import { useQuery, type QueryKey } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { CAGNOTTE_QUERY_KEYS } from "@/modules/cagnotte/constants/queryKeys";
import { useFundingEnvelopeAction } from "@/modules/cagnotte/hooks/useFundingEnvelopeAction";
import { useRetractPledge, type RetractPledgeTarget } from "@/modules/cagnotte/hooks/useRetractPledge";
import { toNumber } from "@/modules/cagnotte/utils/coerce";
import { formatCurrency, formatTime } from "@/modules/cagnotte/utils/format";

/** Une promesse à retirer, avec ce que la confirmation en affiche. */
export interface RetractPledgeRequest extends RetractPledgeTarget {
  financerName: string;
  amount: number;
  depenseName: string;
}

interface RetractPledgeDialogProps {
  /** La promesse à confirmer ; `null` ferme le dialogue. */
  request: RetractPledgeRequest | null;
  onClose: () => void;
  extraInvalidate?: readonly QueryKey[];
  onRetracted?: (target: RetractPledgeTarget) => void;
}

/** Réservation ou facture ouverte, celles de l'utilisateur comprises ; `until` : échéance à venir (s), sinon `null`. */
function readPledgeLock(status: Record<string, unknown>, now: number): { locked: boolean; until: number | null } {
  const locked = status.lock === "bill" || status.lock === "hold";
  const until = locked ? toNumber(status.until) : 0;
  return { locked, until: until * 1000 > now ? until : null };
}

/**
 * Confirmation du retrait d'une promesse : relit à l'ouverture l'état de la promesse (réservation, facture
 * ouverte) et refuse la confirmation pendant un paiement ; reste ouverte pendant l'appel.
 */
export function RetractPledgeDialog({ request, onClose, extraInvalidate, onRetracted }: RetractPledgeDialogProps) {
  useLoadNamespace("modules/cagnotte");
  const t = useT("modules/cagnotte");
  const submit = useFundingEnvelopeAction();
  const { retract, isPending } = useRetractPledge({ extraInvalidate, onRetracted });

  const statusQuery = useQuery({
    queryKey: CAGNOTTE_QUERY_KEYS.PLEDGE_STATUS(request?.answerId ?? null, request?.finkey ?? null),
    enabled: request !== null,
    queryFn: async () => {
      const status = await submit("pledgeStatus", {
        answerId: request?.answerId,
        depenseKey: request?.depenseKey,
        financerId: request?.financerId,
        finkey: request?.finkey,
      });
      return readPledgeLock(status, Date.now());
    },
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const lock = statusQuery.data;
  const isChecking = request !== null && statusQuery.isLoading;

  return (
    <AlertDialog open={request !== null} onOpenChange={(open) => !open && !isPending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{String(t("PledgeRetract.confirm.title"))}</AlertDialogTitle>
          <AlertDialogDescription>
            {request
              ? String(
                  t("PledgeRetract.confirm.description", undefined, {
                    financer: request.financerName,
                    amount: formatCurrency(request.amount),
                    depense: request.depenseName,
                  }),
                )
              : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {lock?.locked ? (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {lock.until !== null
              ? String(t("PledgeRetract.confirm.locked", undefined, { until: formatTime(lock.until * 1000) }))
              : String(t("PledgeRetract.inProgressHint"))}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{String(t("PledgeRetract.confirm.cancel"))}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              if (request) void retract(request).then(onClose);
            }}
            disabled={isPending || isChecking || lock?.locked === true}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending || isChecking ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}
            {String(t("PledgeRetract.confirm.confirm"))}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
