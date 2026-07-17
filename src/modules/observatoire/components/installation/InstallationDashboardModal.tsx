import { useMemo, useState } from "react";
import { Building2, Check, Link2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import "@/modules/observatoire/i18n";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import {
  DEFAULT_INSTALLATION_PARAM,
  type InstallationDashboardConf,
  type ReservationsConf,
} from "@/modules/search/schema";
import { KpiCard } from "../KpiCards";
import { TOKEN_TINT_CLASSES } from "../../dimensions";
import {
  activityDistribution,
  computeEquipmentUsage,
  formatHours,
  utilizationRate,
  weeklyAmplitudeMinutes,
} from "../../installation";
import { useInstallationPoisQuery } from "../../hooks/useInstallationPoisQuery";
import { useInstallationAnswersQuery } from "../../hooks/useInstallationAnswersQuery";
import { EquipmentUtilizationList } from "./EquipmentUtilizationList";
import { EquipmentList } from "./EquipmentList";
import { ActivityDonut } from "./ActivityDonut";

interface InstallationDashboardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Valeur du champ de regroupement (`groupKey`, ex. inst_numero). */
  instValue: string;
  /** Libellé affiché (`labelKey`, ex. inst_nom). */
  instName?: string;
  reservations: ReservationsConf;
  conf: InstallationDashboardConf;
}

/**
 * Modal « mini Observatoire » d'une installation : agrège les équipements
 * partageant `groupKey` et leurs créneaux de réservation (KPI, taux
 * d'utilisation par équipement, répartition des activités). Ouverte
 * PAR-DESSUS le dialog de détail (précédent prod : EditModal/AlertDialog).
 *
 * Composant lazy-loadé par `PreviewPoiAmenities` — tire recharts, monté
 * uniquement à la 1ʳᵉ ouverture (`{open && …}` côté appelant).
 */
export default function InstallationDashboardModal({
  open,
  onOpenChange,
  instValue,
  instName,
  reservations,
  conf,
}: InstallationDashboardModalProps) {
  useLoadNamespace("modules/observatoire");
  const t = useT("modules/observatoire");

  const {
    pois,
    poiIds,
    isLoading: poisLoading,
    error: poisError,
  } = useInstallationPoisQuery(conf, instValue);
  const {
    data: answers,
    isPending: answersPending,
    isError: answersError,
  } = useInstallationAnswersQuery(reservations, poiIds);

  const amplitude = weeklyAmplitudeMinutes(conf.referenceAmplitude);
  const metric = conf.activityMetric ?? "hours";

  // Ouverte par deep-link, la modal n'a pas de nom : on le dérive du 1ᵉʳ POI
  // chargé (`labelKey`) — même source que la fiche équipement.
  const displayName = useMemo(() => {
    if (instName) return instName;
    const sd = pois[0]?.serverData as Record<string, unknown> | undefined;
    const label = sd?.[conf.labelKey];
    return typeof label === "string" ? label.trim() : "";
  }, [instName, pois, conf.labelKey]);

  const [copied, setCopied] = useState(false);
  // Lien de partage : page courante + le SEUL param installation (jamais le
  // `previewParam` de l'équipement) → le destinataire ne voit que cette fiche.
  const handleShare = async () => {
    const param = conf.param ?? DEFAULT_INSTALLATION_PARAM;
    const url = `${window.location.origin}${window.location.pathname}?${param}=${encodeURIComponent(instValue)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(t("installation.share.copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("installation.share.error"));
    }
  };

  const usage = useMemo(
    () => computeEquipmentUsage(answers ?? [], poiIds),
    [answers, poiIds],
  );
  const totalOccupied = useMemo(
    () => [...usage.values()].reduce((sum, u) => sum + u.occupiedMinutes, 0),
    [usage],
  );
  const activities = useMemo(
    () => activityDistribution(answers ?? [], metric, t("installation.unknownActivity")),
    [answers, metric, t],
  );

  // Taux global : occupation totale rapportée à l'amplitude × nb équipements.
  const globalRate = utilizationRate(totalOccupied, amplitude * Math.max(1, poiIds.length));
  // Les réservations chargent tant que les POI ne sont pas connus OU que la
  // requête answers est en vol (dépendante).
  const reservationsLoading = poisLoading || answersPending;
  const hasReservations = (answers?.length ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 sm:max-w-5xl max-h-[90vh] overflow-hidden">
        <DialogTitle className="sr-only">{t("installation.title")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("installation.subtitle", undefined, { count: pois.length })}
        </DialogDescription>

        <div className="flex max-h-[90vh] flex-col">
          <div className="shrink-0 px-6 py-5" style={{ background: "var(--card-header-gradient)" }}>
            <div className="flex items-center gap-2 text-primary-foreground">
              <Building2 className="h-5 w-5 shrink-0" />
              <h2 className="min-w-0 flex-1 truncate text-xl font-bold">
                {displayName || instValue}
              </h2>
              {/* Décalé de la croix de fermeture du DialogContent (top-4 right-4). */}
              <button
                type="button"
                onClick={handleShare}
                aria-label={t("installation.share.action")}
                title={t("installation.share.action")}
                className="mr-7 shrink-0 rounded-md p-1.5 text-primary-foreground/80 transition-colors hover:bg-primary-foreground/15 hover:text-primary-foreground focus-visible:bg-primary-foreground/15"
              >
                {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-sm text-primary-foreground/85">
              {t("installation.subtitle", undefined, { count: pois.length })}
            </p>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
            {poisError ? (
              <p className="text-sm text-destructive">{t("installation.error")}</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <KpiCard
                    icon="dumbbell"
                    label={t("installation.kpi.equipments")}
                    value={String(pois.length)}
                    accentClasses={TOKEN_TINT_CLASSES.primary}
                  />
                  <KpiCard
                    icon="clock"
                    label={t("installation.kpi.reservedHours")}
                    value={`${formatHours(totalOccupied)} h`}
                    accentClasses={TOKEN_TINT_CLASSES["chart-1"]}
                  />
                  <KpiCard
                    icon="gauge"
                    label={t("installation.kpi.utilization")}
                    value={`${Math.round(globalRate * 100)}%`}
                    accentClasses={TOKEN_TINT_CLASSES["chart-2"]}
                  />
                  <KpiCard
                    icon="activity"
                    label={t("installation.kpi.activities")}
                    value={String(activities.length)}
                    accentClasses={TOKEN_TINT_CLASSES["chart-3"]}
                  />
                </div>

                {answersError && (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {t("installation.error")}
                  </p>
                )}

                {/* Sans créneau, jauges à 0 % et donut vide n'apprennent rien :
                    on liste les équipements (déjà chargés, indépendants des answers). */}
                {!reservationsLoading && !hasReservations && !answersError ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {t("installation.noReservations")}
                    </p>
                    <EquipmentList
                      pois={pois}
                      typeKey={conf.typeKey ?? "equip_type_name"}
                      loading={poisLoading}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <EquipmentUtilizationList
                      pois={pois}
                      usage={usage}
                      amplitudeMinutes={amplitude}
                      loading={reservationsLoading}
                    />
                    <ActivityDonut items={activities} metric={metric} loading={reservationsLoading} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
