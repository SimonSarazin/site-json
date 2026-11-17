import { Spinner } from "@/components/ui/spinner";
import type { useT } from "@/hooks/useT";

/**
 * Légende de la bande des cartes équipement (`card.slotsBand`) : la couleur des équipements avec créneaux en cours ou
 * à venir, celle des autres. Sablier tant que les réservations ne sont pas lues — jusque-là, toutes les bandes
 * gardent la couleur d'origine, ce que la légende doit dire plutôt que de laisser croire « aucun créneau ».
 */
export function SlotsBandLegend({
  color,
  loading,
  failed,
  t,
}: {
  /** Couleur CSS des cartes avec créneaux (variable de thème). */
  color: string;
  loading: boolean;
  failed: boolean;
  t: ReturnType<typeof useT>;
}) {
  return (
    <div
      role="group"
      aria-label={t("SlotsBand.legend")}
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
    >
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="h-4 w-1 rounded-sm" style={{ backgroundColor: color }} />
        {t("SlotsBand.planned")}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="h-4 w-1 rounded-sm" style={{ backgroundColor: "var(--card-border-left)" }} />
        {t("SlotsBand.none")}
      </span>
      {loading && <Spinner className="h-3.5 w-3.5" label={t("SlotsBand.loading")} showLabel />}
      {failed && <span>{t("SlotsBand.failed")}</span>}
    </div>
  );
}
