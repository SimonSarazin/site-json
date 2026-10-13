/**
 * Onglet « Paiements » de « Mes promesses de financement » : paiements à rapprocher (encaissés sans
 * enregistrement abouti) et historique, avec reprise de l'enregistrement (`cagnotteSettle`). Un admin de
 * l'entité voit tous les paiements de la cagnotte, un contributeur les siens.
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { showErrorToast, showSuccessToast } from "@/lib/toastUtils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { CAGNOTTE_QUERY_KEYS } from "@/modules/cagnotte/constants/queryKeys";
import { useCagnotteBills } from "@/modules/cagnotte/hooks/useCagnotteBills";
import { useFundingEnvelopeAction } from "@/modules/cagnotte/hooks/useFundingEnvelopeAction";
import { readSettlement } from "@/modules/cagnotte/hooks/usePaymentSettlement";
import {
  billStatusKey,
  isBillToReconcile,
  type CagnotteBill,
  type CagnotteBillFilter,
} from "@/modules/cagnotte/services/cagnotteBills";
import { formatDate, formatNumber } from "@/modules/cagnotte/utils/format";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  settled: "secondary",
  unrecorded: "destructive",
  settling: "outline",
  pending: "outline",
  expired: "outline",
  unknown: "outline",
};

function BillsTable({ filter }: { filter: CagnotteBillFilter }) {
  const t = useT("modules/cagnotte");
  const queryClient = useQueryClient();
  const submit = useFundingEnvelopeAction();
  const { data, isLoading, error } = useCagnotteBills(filter);
  const [retrying, setRetrying] = useState<string | null>(null);
  const bills = data?.bills ?? [];
  // Portée `mine` : ses propres paiements, pas de colonne Payeur.
  const showPayer = data?.scope !== "mine";

  const retry = async (bill: CagnotteBill) => {
    setRetrying(bill.id);
    try {
      const settlement = readSettlement(await submit("cagnotteSettle", { bill: bill.id }), bill.id);
      if (settlement.recorded) {
        showSuccessToast("PaymentsPanel.toasts.recorded", t);
      } else {
        const reason = settlement.error ?? String(t(settlement.inProgress ? "PaymentsPanel.inProgress" : "PaymentsPanel.notPaid"));
        showErrorToast(new Error(reason), "PaymentsPanel.toasts.notRecorded", t);
      }
    } catch (failure) {
      showErrorToast(failure, "PaymentsPanel.toasts.notRecorded", t);
    } finally {
      setRetrying(null);
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: CAGNOTTE_QUERY_KEYS.CAGNOTTE_BILLS_PREFIX() }),
        queryClient.invalidateQueries({ queryKey: CAGNOTTE_QUERY_KEYS.FUNDING_ENVELOPE_PREFIX() }),
      ]);
    }
  };

  if (isLoading) {
    return <p className="py-6 text-sm text-muted-foreground">{t("PaymentsPanel.loading")}</p>;
  }
  if (error) {
    return <p className="py-6 text-sm text-destructive">{error instanceof Error ? error.message : String(error)}</p>;
  }
  if (bills.length === 0) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        {t(filter === "attention" ? "PaymentsPanel.emptyAttention" : "PaymentsPanel.emptyAll")}
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("PaymentsPanel.columns.date")}</TableHead>
          {showPayer && <TableHead>{t("PaymentsPanel.columns.payer")}</TableHead>}
          <TableHead className="text-right">{t("PaymentsPanel.columns.amount")}</TableHead>
          <TableHead>{t("PaymentsPanel.columns.provider")}</TableHead>
          <TableHead>{t("PaymentsPanel.columns.status")}</TableHead>
          <TableHead>{t("PaymentsPanel.columns.reference")}</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {bills.map((bill) => {
          const status = billStatusKey(bill);
          return (
            <TableRow key={bill.id}>
              <TableCell>{bill.created > 0 ? formatDate(bill.created * 1000) : "—"}</TableCell>
              {showPayer && <TableCell>{bill.payer.name || bill.payer.id || "—"}</TableCell>}
              <TableCell className="text-right">{formatNumber(bill.amount)} €</TableCell>
              <TableCell>{bill.provider === "helloasso" ? "HelloAsso" : "Stripe"}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[status] ?? "outline"}>{t(`PaymentsPanel.status.${status}`)}</Badge>
                {bill.error && <p className="mt-1 max-w-xs text-xs text-destructive">{bill.error}</p>}
              </TableCell>
              <TableCell className="font-mono text-xs">{bill.reference ?? "—"}</TableCell>
              <TableCell>
                {isBillToReconcile(bill) && (
                  <Button size="sm" onClick={() => void retry(bill)} disabled={retrying !== null}>
                    {retrying === bill.id && <Loader className="w-4 h-4 mr-2 animate-spin" />}
                    {t("PaymentsPanel.retry")}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function CagnottePaymentsPanel() {
  useLoadNamespace("modules/cagnotte");
  const t = useT("modules/cagnotte");
  const [filter, setFilter] = useState<CagnotteBillFilter>("attention");
  // Même requête que la table active, pour la portée.
  const { data } = useCagnotteBills(filter);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {data && `${String(t(`PaymentsPanel.scope.${data.scope}`))} `}
        {t("PaymentsPanel.description")}
      </p>
      <Tabs value={filter} onValueChange={(value) => setFilter(value === "all" ? "all" : "attention")}>
        <TabsList>
          <TabsTrigger value="attention">{t("PaymentsPanel.tabs.attention")}</TabsTrigger>
          <TabsTrigger value="all">{t("PaymentsPanel.tabs.all")}</TabsTrigger>
        </TabsList>
        <TabsContent value="attention" className="overflow-x-auto">
          <BillsTable filter="attention" />
        </TabsContent>
        <TabsContent value="all" className="overflow-x-auto">
          <BillsTable filter="all" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CagnottePaymentsPanel;
