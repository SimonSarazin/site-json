import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { useT } from "@/hooks/useT";
import { USAGE_SORT_ORDERS, type UsageSortOrder } from "../lib/usageSort";

/** Valeur du tri par nom (Radix Select n'accepte pas une valeur vide). */
const BY_NAME = "__name__";

/**
 * Sélecteur « Trier » de la liste (`searchProStatic.usageSort`) : par nom (tri du serveur) ou par taux
 * d'occupation, décroissant ou croissant. Sablier pendant le calcul des taux, bouton de nouvel essai en cas
 * d'échec — les états de `useUsageSort`.
 */
export function UsageSortControl({
  label,
  order,
  loading,
  failed,
  onChange,
  onRetry,
  t,
}: {
  label: string;
  order: UsageSortOrder | null;
  loading: boolean;
  failed: boolean;
  onChange: (next: UsageSortOrder | null) => void;
  onRetry: () => void;
  t: ReturnType<typeof useT>;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select value={order ?? BY_NAME} onValueChange={(v) => onChange(v === BY_NAME ? null : (v as UsageSortOrder))}>
        <SelectTrigger className="h-8 w-auto min-w-48 bg-background text-xs" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={BY_NAME}>{t("UsageSort.name")}</SelectItem>
          {USAGE_SORT_ORDERS.map((o) => (
            <SelectItem key={o} value={o}>
              {t(`UsageSort.${o}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {loading && <Spinner className="h-4 w-4" label={t("UsageSort.pending")} />}
      {failed && (
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onRetry}>
          {t("UsageSort.retry")}
        </Button>
      )}
    </div>
  );
}
