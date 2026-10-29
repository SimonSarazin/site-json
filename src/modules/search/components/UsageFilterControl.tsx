import type { UsageStatus } from "@/modules/observatoire/usage";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { useT } from "@/hooks/useT";
import { USAGE_STATUSES } from "../lib/usageFilter";

/** Valeur du choix « tous les statuts » (Radix Select n'accepte pas une valeur vide). */
const ALL = "__all__";

/**
 * Sélecteur du filtre « Statut d'ouverture » du bandeau (`searchHeader.usageFilter`) : un statut à la fois,
 * ou tous. Sablier tant que les réservations n'ont pas permis de publier le filtre, bouton de nouvel essai
 * en cas d'échec — les états de `useUsageFilter`.
 */
export function UsageFilterControl({
  label,
  status,
  pending,
  error,
  onApply,
  onRetry,
  t,
}: {
  label: string;
  status: UsageStatus | null;
  pending: boolean;
  error: boolean;
  onApply: (next: UsageStatus | null) => void;
  onRetry: () => void;
  t: ReturnType<typeof useT>;
}) {
  return (
    <div className="flex items-center gap-2">
      <Select value={status ?? ALL} onValueChange={(v) => onApply(v === ALL ? null : (v as UsageStatus))}>
        <SelectTrigger className="h-9 w-auto min-w-44 bg-background" aria-label={label}>
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("UsageFilter.all", undefined, { label })}</SelectItem>
          {USAGE_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {t(`UsageFilter.${s}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pending && <Spinner className="h-4 w-4" label={t("UsageFilter.pending")} />}
      {error && (
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onRetry}>
          {t("UsageFilter.retry")}
        </Button>
      )}
    </div>
  );
}
