import { Suspense, useMemo, useState } from "react";
import { Link } from "react-router";
import { lazy } from "vite-preload";
import { CalendarClock, MapPin, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import "@/modules/search/i18n";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useCocolight } from "@/hooks/useCocolight";
import { formatHours } from "@/modules/observatoire/installation";
import { KpiCard } from "@/modules/observatoire/components/KpiCard";
import { useProfilPermissions } from "@/modules/profil/hooks/useProfilPermissions";
import { useBookingChecks } from "../../hooks/useBookingChecks";
import { usePeriodFilter } from "../../hooks/usePeriodFilter";
import { useOrgaReservationsQuery } from "../../hooks/useOrgaReservationsQuery";
import { useResourcesInPerimeterQuery } from "../../hooks/useResourcesInPerimeterQuery";
import { useUpdateSlotHours } from "../../hooks/useUpdateSlotHours";
import {
  groupReservationsByResource,
  ownSlotPeriod,
  resourceGroupsInPeriod,
} from "../../lib/reservations";
import { keepInPerimeter } from "../../lib/reservationUsers";
import { buildReservationPrefill } from "../../lib/reservationPrefill";
import { formatReservationPeriod, slotHoursContext } from "../../lib/reservationPeriod";
import { formatReservationHours, sumReservationHours, weeklyReferenceDay } from "../../lib/reservationHours";
import { localIsoDay } from "../../lib/slotFilter";
import {
  DEFAULT_PREVIEW_PARAM,
  type BookedResourcesConf,
  type ReservationsConf,
} from "../../schema";
import { PeriodFilter } from "./PeriodFilter";
import { SlotHoursDialog } from "./SlotHoursDialog";

// Modale CoForm en lazy, comme sur la fiche équipement : le chunk coform n'est tiré qu'au premier ajout.
const CoFormModal = lazy(() => import("@/modules/coform/components/CoFormModal"));

/**
 * Section « équipements réservés » de la fiche ORGANISATION (`preview.structure`)
 * — le pendant de `PreviewReservations`, lu depuis l'autre bout du lien : là,
 * les clubs d'un équipement ; ici, les équipements d'un club.
 *
 * Le nom de chaque équipement vient du finder de la réponse elle-même : aucune
 * requête POI par ligne. Le bouton « fiche », lui, a besoin de l'identifiant —
 * que le finder porte toujours.
 *
 * Avec `conf.periods`, même filtre « du … au … » et même défaut que la fiche
 * équipement (en cours ou à venir). Avec `conf.booking`, les admins ajoutent un
 * créneau sur chaque équipement et, avec `booking.editHours`, en modifient l'horaire.
 *
 * Montée uniquement si le site configure `preview.bookedResources` — chargée en
 * lazy par `PreviewStructure`.
 */
export default function PreviewBookedResources({
  orgaId,
  orgaName,
  conf,
  booked,
}: {
  orgaId: string;
  /** Nom de l'organisation — repris dans le finder pré-rempli d'un ajout. */
  orgaName?: string;
  conf: ReservationsConf;
  booked: BookedResourcesConf;
}) {
  useLoadNamespace("modules/search");
  const t = useT("modules/search");
  const { data, isLoading: reservationsLoading, isError: reservationsError } = useOrgaReservationsQuery({ orgaId, conf });
  const today = useMemo(() => localIsoDay(new Date()), []);
  const column = booked.placement === "column";

  // Périmètre du site (`booked.poiFilters`, opt-in) : une organisation réserve aussi AILLEURS — on ne
  // garde que les équipements du site, ceux dont le bouton « fiche » ouvre bien une fiche ici.
  // Sans périmètre : aucune requête de plus, tous les équipements (comportement historique).
  // Jugé sur TOUTES ses réservations, avant le filtre de période : la requête ne dépend pas des dates.
  const allGroups = useMemo(() => groupReservationsByResource(data ?? []), [data]);
  const resourceIds = useMemo(() => allGroups.map((g) => g.resourceId), [allGroups]);
  const perimetre = useResourcesInPerimeterQuery(resourceIds, booked);
  const inPerimeter = useMemo(() => keepInPerimeter(allGroups, perimetre.allowed), [allGroups, perimetre.allowed]);
  const isLoading = reservationsLoading || perimetre.isLoading;
  const isError = reservationsError || perimetre.isError;

  /* ── Période (opt-in `conf.periods`) — mêmes règles que la fiche équipement ── */
  const periods = Boolean(conf.periods);
  const { range, filter: periodFilter } = usePeriodFilter(periods, today);
  const groups = useMemo(
    () => (range ? resourceGroupsInPeriod(inPerimeter, range) : inPerimeter),
    [inPerimeter, range],
  );

  // Volume horaire (opt-in `booked.hours`) : celui de chaque équipement LISTÉ, dans l'ordre de
  // `groups`, et le total de l'organisation sur ces seuls équipements — la somme des lignes, l'hebdomadaire
  // lu au même jour de référence pour toutes.
  const hours = useMemo(() => {
    if (!booked.hours) return null;
    const since = range?.periodStart ?? today;
    const affichees = groups.flatMap((g) => g.reservations);
    const reference = weeklyReferenceDay(affichees, since);
    return {
      total: sumReservationHours(affichees, since, undefined, reference),
      byGroup: groups.map((g) => sumReservationHours(g.reservations, since, undefined, reference)),
    };
  }, [booked.hours, groups, range, today]);
  const link = booked.link;
  const previewParam = link?.previewParam ?? DEFAULT_PREVIEW_PARAM;

  /* ── Ajout et modification (opt-in `conf.booking`, admins) ───────────────── */
  const { entity } = useCocolight();
  const permissions = useProfilPermissions(entity || null);
  const booking = conf.booking;
  const canBook = Boolean(booking) && (booking?.adminOnly === false || permissions.isAdmin);
  const canEditHours = Boolean(booking?.editHours) && permissions.isAdmin;
  const [adding, setAdding] = useState<{ resourceId: string; resourceName: string } | null>(null);
  const {
    editing,
    open: editHours,
    close: closeHours,
    submit: submitHours,
    checkLive: checkHoursLive,
    saving: savingHours,
  } = useUpdateSlotHours(conf);

  const prefill = useMemo(
    () =>
      adding
        ? buildReservationPrefill(conf, {
          resourceId: adding.resourceId,
          resourceName: adding.resourceName,
          orga: { id: orgaId, name: orgaName },
        })
        : null,
    [adding, conf, orgaId, orgaName],
  );

  // Contrôles de la saisie, communs à tous les formulaires d'ajout : avertissement EN DIRECT sous chaque
  // créneau, refus d'ENREGISTRER sur les réservations RELUES de chaque équipement envoyé (aucun contrôle
  // serveur n'existe). Sans `periods`, ni l'un ni l'autre — comme sur la fiche équipement. Après
  // l'enregistrement, cette fiche, celles des équipements et le filtre créneau se relisent (`afterSave`).
  const { beforeSubmit, slotCheck, afterSave } = useBookingChecks(conf);

  // Aucune réservation : la section disparaît. La plupart des organisations de
  // l'annuaire n'en ont pas — un bloc « aucun équipement » sur chaque fiche
  // serait du bruit, là où la section n'a de sens que remplie. En colonne, elle reste,
  // avec un message : la colonne des réservations ne doit pas rester vide.
  if (!isLoading && !isError && inPerimeter.length === 0 && !column) return null;

  return (
    <section className="rounded-2xl border border-border bg-card/70 p-5 shadow-sm">
      <div className="flex items-center gap-2 text-primary">
        <CalendarClock className="h-5 w-5" aria-hidden />
        <h2 className="text-base font-semibold">
          {booked.label ? t(booked.label) : t("PreviewBookedResources.title")}
        </h2>
        {groups.length > 0 && <Badge variant="secondary">{groups.length}</Badge>}
      </div>
      {/* Volume horaire en INDICATEURS au-dessus de la liste (demande de Peterson du 23/10). */}
      {hours && !isError && (isLoading || groups.length > 0) && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <KpiCard
            icon="clock"
            label={t("PreviewReservations.kpiWeekly")}
            value={formatHours(hours.total.weeklyMinutes)}
            accentClasses="bg-chart-2/15 text-chart-2"
            loading={isLoading}
            loadingLabel={t("PreviewReservations.kpiLoading")}
          />
          <KpiCard
            icon="calendar-clock"
            label={t("PreviewReservations.kpiCumulative")}
            value={formatHours(hours.total.cumulativeMinutes)}
            accentClasses="bg-chart-4/15 text-chart-4"
            loading={isLoading}
            loadingLabel={t("PreviewReservations.kpiLoading")}
          />
        </div>
      )}

      {periods && inPerimeter.length > 0 && (
        <PeriodFilter {...periodFilter} t={t} />
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
      ) : groups.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {inPerimeter.length > 0 ? t("PreviewReservations.emptyPeriod") : t("PreviewBookedResources.empty")}
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
                          <li key={i} className="flex items-center gap-1">
                            <span>
                              <span className="font-medium text-foreground">{t(`days.${s.day}`)}</span>{" "}
                              {s.start} – {s.end}
                              {own && ` · ${formatReservationPeriod(own, t)}`}
                            </span>
                            {canEditHours && r.id && s.index !== undefined && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={() => editHours(r, s)}
                                aria-label={t("PreviewReservations.editHours.aria", undefined, {
                                  day: t(`days.${s.day}`),
                                  start: s.start,
                                  end: s.end,
                                })}
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden />
                              </Button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
                {canBook && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs"
                    onClick={() => setAdding({ resourceId: g.resourceId, resourceName: g.resourceName })}
                    aria-label={t("PreviewBookedResources.addSlotAria", undefined, {
                      name: g.resourceName || t("PreviewBookedResources.unknownResource"),
                    })}
                  >
                    <Plus className="h-3 w-3" aria-hidden />
                    {t("PreviewBookedResources.addSlot")}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {prefill && adding && (
        <Suspense fallback={null}>
          {/* Équipement ET organisation verrouillés : on ajoute un créneau à CE club sur CET équipement.
              `elementId` qualifie le brouillon (cf. `PreviewReservations`). Pas de période par créneau :
              une réservation vaut pour une période. */}
          <CoFormModal
            formId={conf.form}
            open
            onOpenChange={(next) => { if (!next) setAdding(null); }}
            title={t("PreviewBookedResources.addTitle", undefined, {
              name: adding.resourceName || t("PreviewBookedResources.unknownResource"),
            })}
            defaultValues={prefill.defaultValues}
            lockedFields={prefill.lockedFields}
            elementId={adding.resourceId}
            elementType="poi"
            onAfterSubmit={afterSave}
            beforeSubmit={periods ? beforeSubmit : undefined}
            slotCheck={periods ? slotCheck : undefined}
            hideStepHeaders
          />
        </Suspense>
      )}

      {editing && (
        <SlotHoursDialog
          key={`${editing.reservation.id}-${editing.slot.index}`}
          open
          onOpenChange={(next) => { if (!next) closeHours(); }}
          context={slotHoursContext(editing.reservation, editing.slot, t)}
          start={editing.slot.start}
          end={editing.slot.end}
          saving={savingHours}
          onSubmit={submitHours}
          onCheck={checkHoursLive}
          t={t}
        />
      )}
    </section>
  );
}
