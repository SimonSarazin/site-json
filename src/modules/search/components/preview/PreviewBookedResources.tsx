import { useMemo } from "react";
import { Link } from "react-router";
import { CalendarClock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import "@/modules/search/i18n";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useOrgaReservationsQuery } from "../../hooks/useOrgaReservationsQuery";
import { useResourcesInPerimeterQuery } from "../../hooks/useResourcesInPerimeterQuery";
import { groupReservationsByResource, ownSlotPeriod } from "../../lib/reservations";
import { keepInPerimeter } from "../../lib/reservationUsers";
import { formatReservationPeriod } from "../../lib/reservationPeriod";
import { formatReservationHours, sumReservationHours } from "../../lib/reservationHours";
import { localIsoDay } from "../../lib/slotFilter";
import {
  DEFAULT_PREVIEW_PARAM,
  type BookedResourcesConf,
  type ReservationsConf,
} from "../../schema";

/**
 * Section « équipements réservés » de la fiche ORGANISATION (`preview.structure`)
 * — le pendant de `PreviewReservations`, lu depuis l'autre bout du lien : là,
 * les clubs d'un équipement ; ici, les équipements d'un club.
 *
 * Le nom de chaque équipement vient du finder de la réponse elle-même : aucune
 * requête POI par ligne. Le bouton « fiche », lui, a besoin de l'identifiant —
 * que le finder porte toujours.
 *
 * Montée uniquement si le site configure `preview.bookedResources` — chargée en
 * lazy par `PreviewStructure`.
 */
export default function PreviewBookedResources({
  orgaId,
  conf,
  booked,
}: {
  orgaId: string;
  conf: ReservationsConf;
  booked: BookedResourcesConf;
}) {
  useLoadNamespace("modules/search");
  const t = useT("modules/search");
  const { data, isLoading: reservationsLoading, isError: reservationsError } = useOrgaReservationsQuery({ orgaId, conf });

  const allGroups = useMemo(() => groupReservationsByResource(data ?? []), [data]);
  // Périmètre du site (`booked.poiFilters`, opt-in) : une organisation réserve aussi AILLEURS — on ne
  // garde que les équipements du site, ceux dont le bouton « fiche » ouvre bien une fiche ici.
  // Sans périmètre : aucune requête de plus, tous les équipements (comportement historique).
  const resourceIds = useMemo(() => allGroups.map((g) => g.resourceId), [allGroups]);
  const perimetre = useResourcesInPerimeterQuery(resourceIds, booked);
  const groups = useMemo(() => keepInPerimeter(allGroups, perimetre.allowed), [allGroups, perimetre.allowed]);
  const isLoading = reservationsLoading || perimetre.isLoading;
  const isError = reservationsError || perimetre.isError;

  // Volume horaire (opt-in `booked.hours`) : celui de chaque équipement LISTÉ, dans l'ordre de
  // `groups`, et le total de l'organisation sur ces seuls équipements — la somme des lignes.
  const hours = useMemo(() => {
    if (!booked.hours) return null;
    const today = localIsoDay(new Date());
    return {
      total: sumReservationHours(groups.flatMap((g) => g.reservations), today),
      byGroup: groups.map((g) => sumReservationHours(g.reservations, today)),
    };
  }, [booked.hours, groups]);
  const link = booked.link;
  const previewParam = link?.previewParam ?? DEFAULT_PREVIEW_PARAM;

  // Aucune réservation : la section disparaît. La plupart des organisations de
  // l'annuaire n'en ont pas — un bloc « aucun équipement » sur chaque fiche
  // serait du bruit, là où la section n'a de sens que remplie.
  if (!isLoading && !isError && groups.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card/70 p-5 shadow-sm">
      <div className="flex items-center gap-2 text-primary">
        <CalendarClock className="h-5 w-5" aria-hidden />
        <h2 className="text-base font-semibold">
          {booked.label ? t(booked.label) : t("PreviewBookedResources.title")}
        </h2>
        {groups.length > 0 && <Badge variant="secondary">{groups.length}</Badge>}
      </div>
      {hours && !isLoading && !isError && (
        <p className="mt-1 text-sm text-muted-foreground">{formatReservationHours(hours.total, t, true)}</p>
      )}

      {isLoading ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-2/3" />
        </div>
      ) : isError ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {t("PreviewBookedResources.error")}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {groups.map((g, gi) => (
            <li
              key={g.resourceId}
              className="rounded-lg border border-border/60 bg-background/60 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span className="truncate text-sm font-medium text-foreground">
                    {g.resourceName || t("PreviewBookedResources.unknownResource")}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {t("PreviewBookedResources.slotCount", undefined, { count: g.slotCount })}
                  </span>
                  {link && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-xs"
                    >
                      <Link
                        to={`${link.path}?${previewParam}=${encodeURIComponent(g.resourceId)}`}
                        aria-label={t("PreviewBookedResources.sheetAria", undefined, {
                          name: g.resourceName || t("PreviewBookedResources.unknownResource"),
                        })}
                      >
                        {t("PreviewBookedResources.sheet")}
                      </Link>
                    </Button>
                  )}
                </div>
              </div>

              {/* Volume horaire de l'équipement, sur SA ligne (alignée sur les réservations) : à
                  droite avec le nombre de créneaux, il élargissait la rangée au point de pousser le
                  bouton « Fiche » hors de la fiche en mobile. */}
              {hours && (
                <p className="mt-1 pl-6 text-xs text-muted-foreground">
                  {formatReservationHours(hours.byGroup[gi], t)}
                </p>
              )}

              <div className="mt-2 space-y-2 pl-6">
                {g.reservations.map((r, ri) => (
                  <div key={r.id || `res-${ri}`} className="text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      {r.activity && <span className="font-medium">{r.activity}</span>}
                      {r.bookingType && <Badge variant="secondary">{r.bookingType}</Badge>}
                    </div>
                    {(r.periodStart || r.periodEnd) && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatReservationPeriod(r, t)}
                      </p>
                    )}
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {r.slots.map((s, i) => {
                        // Même règle que la fiche équipement : la période propre d'un créneau, seulement
                        // quand elle diffère de celle de la réservation.
                        const own = ownSlotPeriod(s, r);
                        return (
                          <li key={i}>
                            <span className="font-medium text-foreground">{t(`days.${s.day}`)}</span>{" "}
                            {s.start} – {s.end}
                            {own && ` · ${formatReservationPeriod(own, t)}`}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
