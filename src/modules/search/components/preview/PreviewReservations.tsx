import { Suspense, useCallback, useMemo, useState } from "react";
import { Link } from "react-router";
import { lazy } from "vite-preload";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, CalendarClock, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import "@/modules/search/i18n";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useCocolight } from "@/hooks/useCocolight";
import { useAuthModal } from "@/modules/auth";
import { formatHours } from "@/modules/observatoire/installation";
import { KpiCard } from "@/modules/observatoire/components/KpiCard";
import { useProfilPermissions } from "@/modules/profil/hooks/useProfilPermissions";
import { useBookingChecks } from "../../hooks/useBookingChecks";
import { usePeriodFilter } from "../../hooks/usePeriodFilter";
import { resourcesReservations, useReservationsQuery } from "../../hooks/useReservationsQuery";
import { useUpdateSlotHours } from "../../hooks/useUpdateSlotHours";
import { DAY_KEYS, type DayKey } from "../../lib/schedules";
import {
  buildBookingGrid,
  buildWeeklyGrid,
  distinctPeriods,
  groupReservationsByUser,
  mergeBookingRows,
  ownSlotPeriod,
  reservationColor,
  reservationConflicts,
  reservationsInPeriod,
  type BookingCell,
  type WeeklySlotBlock,
} from "../../lib/reservations";
import type { PeriodRange } from "../../lib/reservationBooking";
import { buildReservationPrefill } from "../../lib/reservationPrefill";
import { formatPeriodShort, formatReservationPeriod, slotHoursContext } from "../../lib/reservationPeriod";
import { formatReservationHours, sumReservationHours, weeklyReferenceDay } from "../../lib/reservationHours";
import { localIsoDay } from "../../lib/slotFilter";
import { DEFAULT_PREVIEW_PARAM, type ReservationsConf } from "../../schema";
import { PeriodFilter } from "./PeriodFilter";
import { SlotHoursDialog } from "./SlotHoursDialog";

// Modale CoForm en lazy : le chunk coform ne doit être tiré qu'à la première
// demande de réservation, jamais à l'affichage de la fiche.
const CoFormModal = lazy(() => import("@/modules/coform/components/CoFormModal"));

type Translate = ReturnType<typeof useT>;

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </p>
  );
}

/**
 * Bloc de créneau de la grille hebdo. Détail via Popover au CLIC (fonctionne
 * aussi au tactile, contrairement au tooltip hover-only). La couleur d'usager
 * n'est qu'une barre latérale : l'identité reste portée par le texte. La période
 * du créneau s'y lit d'emblée, en dates courtes : depuis l'import « une
 * réservation par période », un même créneau peut figurer une fois par
 * trimestre dans la même case. `fill` étire la carte sur toute sa cellule — la
 * plage fusionnée d'un créneau qui couvre plusieurs rangées. Survol en `bg-muted`,
 * pas en `bg-accent` : l'accent est une couleur de marque (jaune sur ESS974, orange
 * sur Saint-Paul) sur laquelle le texte gris de la carte ne se lisait plus.
 */
function SlotBlock({ block, t, fill = false }: { block: WeeklySlotBlock; t: Translate; fill?: boolean }) {
  const userLabel = block.user || t("PreviewReservations.unknownUser");
  const periode = formatPeriodShort(block, t);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex w-full flex-col justify-start rounded-md border border-border border-l-4 bg-card px-2 py-1.5 text-left text-xs shadow-sm transition-colors hover:bg-muted ${fill ? "h-full" : ""}`}
          style={{ borderLeftColor: reservationColor(block.colorIndex) }}
        >
          <span className="block font-semibold text-foreground">
            {block.start} – {block.end}
          </span>
          <span className="block truncate text-muted-foreground">{userLabel}</span>
          {periode && <span className="block text-[11px] leading-tight text-muted-foreground">{periode}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-1.5 text-sm">
        <p className="font-semibold">{userLabel}</p>
        {block.activity && (
          <DetailRow label={t("PreviewReservations.activityLabel")} value={block.activity} />
        )}
        {block.bookingType && (
          <DetailRow label={t("PreviewReservations.bookingTypeLabel")} value={block.bookingType} />
        )}
        {(block.periodStart || block.periodEnd) && (
          <DetailRow label={t("PreviewReservations.periodLabel")} value={formatReservationPeriod(block, t)} />
        )}
        <DetailRow label={t(`days.${block.dayKey}`)} value={`${block.start} – ${block.end}`} />
        {/* Créneaux jointifs fusionnés dans ce bloc : chacun garde sa ligne. */}
        {block.parts && (
          <ul className="space-y-0.5 border-t border-border/60 pt-1.5 text-xs text-muted-foreground">
            {block.parts.map((p) => (
              <li key={p.key}>
                {p.start} – {p.end}
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Case libre de la grille de réservation : bouton d'ouverture du formulaire. */
function FreeCell({
  cell,
  t,
  onBook,
}: {
  cell: BookingCell;
  t: Translate;
  onBook: (cell: BookingCell) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onBook(cell)}
      aria-label={t("PreviewReservations.bookAria", undefined, {
        day: t(`days.${cell.dayKey}`),
        start: cell.start,
        end: cell.end,
      })}
      className="group flex h-full w-full items-center justify-center rounded-md border border-dashed border-border/70 py-2 text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
    >
      <Plus className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">{t("PreviewReservations.free")}</span>
    </button>
  );
}

/**
 * Section « Réservations » du preview `poi-amenities` : usagers en accordion
 * (qui sert aussi de légende couleur) + grille hebdomadaire Lun→Dim (≥ md) ou
 * liste groupée par jour (mobile). Montée uniquement si le site configure
 * `preview.reservations` — chargée en lazy par `PreviewPoiAmenities`.
 *
 * Avec `conf.periods`, tout ce qui suit le filtre de période ne voit que les
 * créneaux de la période choisie : liste, grille, heures et cases libres.
 */
export default function PreviewReservations({
  resourceId,
  resourceName,
  conf,
}: {
  resourceId: string;
  /** Nom de l'équipement — repris dans le finder pré-rempli du formulaire. */
  resourceName?: string;
  conf: ReservationsConf;
}) {
  useLoadNamespace("modules/search");
  const t = useT("modules/search");
  const { data, isLoading, isError } = useReservationsQuery({ resourceId, conf });
  const today = useMemo(() => localIsoDay(new Date()), []);

  /* ── Période de la section (opt-in `conf.periods`) ───────────────────────── */
  const periods = Boolean(conf.periods);
  const { range, filter: periodFilter } = usePeriodFilter(periods, today);
  // Sans `periods`, toutes les réservations (comportement historique). Avec, les seuls créneaux de la
  // période : c'est d'eux que dépendent la liste, la grille, les cases libres et les heures.
  const shown = useMemo(
    () => (range ? reservationsInPeriod(data ?? [], range) : (data ?? [])),
    [data, range],
  );

  const groups = useMemo(() => groupReservationsByUser(shown), [shown]);
  const grid = useMemo(() => buildWeeklyGrid(groups), [groups]);
  const hasSlots = grid.some((day) => day.blocks.length > 0);

  // Volume horaire (opt-in `conf.hours`) : celui de l'équipement, puis celui de chaque usager, dans
  // l'ordre de `groups`. Seuls les créneaux en cours ou à venir comptent (`reservationHours.ts`) ; avec
  // une période choisie, ceux qu'elle affiche — comptés depuis son début. L'hebdomadaire se lit au jour
  // de RÉFÉRENCE, calculé une fois sur tout l'affiché : la somme des usagers reste le total.
  const hours = useMemo(() => {
    if (!conf.hours) return null;
    const since = range?.periodStart ?? today;
    const reference = weeklyReferenceDay(shown, since);
    return {
      total: sumReservationHours(shown, since, undefined, reference),
      byGroup: groups.map((g) => sumReservationHours(g.reservations, since, undefined, reference)),
    };
  }, [conf.hours, shown, groups, range, today]);

  // Périodes de chaque usager (avec `periods`), lisibles fiche repliée : depuis l'import « une
  // réservation par période », un club occupe l'équipement par trimestres ou par cycles.
  const periodsByGroup = useMemo(
    () => (periods ? groups.map((g) => distinctPeriods(g.reservations)) : null),
    [periods, groups],
  );

  // Lien « fiche » du club usager (opt-in `conf.orgaLink`) — cf. le rendu de la
  // rangée usager plus bas : n'apparaît que sur un groupe porteur d'identifiant.
  const orgaLink = conf.orgaLink;

  /* ── Prise de réservation (opt-in `conf.booking`) ───────────────────────── */
  const booking = conf.booking;
  const { me, entity } = useCocolight();
  const { openLogin } = useAuthModal();
  const permissions = useProfilPermissions(entity || null);
  const queryClient = useQueryClient();
  // Ajout en cours : la case cliquée, avec la période choisie AU MOMENT du clic (c'est elle que le contrôle a
  // validée, c'est donc elle que le formulaire reprend) — ou le club d'une rangée, imposé au formulaire.
  const [adding, setAdding] = useState<{
    slot?: { day: DayKey; startMinutes: number; endMinutes: number };
    period?: PeriodRange;
    orga?: { id: string; name?: string };
  } | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  // Réserver est réservé aux admins de l'entité du site par défaut : aucun
  // contrôle serveur ne vérifie aujourd'hui QUI réserve POUR QUI.
  const canBook = Boolean(booking) && (booking?.adminOnly === false || permissions.isAdmin);

  /* ── Modification d'horaire (opt-in `conf.booking.editHours`) ──────────── */
  // Toujours réservée aux admins, `adminOnly` ou non : elle touche la réservation d'un autre.
  const canEditHours = Boolean(booking?.editHours) && permissions.isAdmin;
  const {
    editing,
    open: editHours,
    close: closeHours,
    submit: submitHours,
    checkLive: checkHoursLive,
    saving: savingHours,
  } = useUpdateSlotHours(conf);

  const rows = useMemo(
    () => (booking ? mergeBookingRows(buildBookingGrid(grid, booking)) : []),
    [booking, grid],
  );

  // GARDE DE FRAÎCHEUR — elle ne vaut que si elle interroge des données FRAÎCHES.
  // Rejouée sur `data`, elle ne pouvait rien détecter : la case n'est cliquable que si
  // `cell.blocks` est vide, et `blocks` sort du MÊME instantané avec un test d'intersection
  // strictement plus large que celui de `reservationConflicts` — le message de conflit était
  // donc inatteignable. `useReservationsQuery` posant `staleTime: 5 min`, deux gestionnaires
  // pouvaient réserver le même créneau sans le moindre avertissement. On refetche donc les
  // réservations avant d'ouvrir le formulaire, et de nouveau avant d'enregistrer (`beforeSubmit`).
  // NB : cela RÉDUIT la fenêtre de course, sans la fermer — seul un contrôle serveur le ferait,
  // et il n'existe pas aujourd'hui côté backend. Réseau indisponible : l'instantané en cache
  // (`resourcesReservations`) plutôt que de bloquer la réservation.
  const freshReservations = useCallback(
    () => (entity ? resourcesReservations(queryClient, entity, conf, [resourceId], true) : Promise.resolve(data ?? [])),
    [conf, data, entity, queryClient, resourceId],
  );

  const handleBook = useCallback(
    async (cell: BookingCell) => {
      if (!me) {
        // NB : le créneau cliqué n'est PAS repris après connexion — l'utilisateur doit recliquer.
        // Le faire demanderait de rejouer l'action depuis `onSuccess`, ce que les règles de hooks
        // du dépôt (`react-hooks/immutability`, `set-state-in-effect`) interdisent d'écrire ici ;
        // la reprise a sa place dans `AuthModalProvider`, pas dans ce composant. Branche par
        // ailleurs inatteignable tant qu'aucune config ne pose `booking.adminOnly: false`.
        openLogin();
        return;
      }
      const candidat = {
        slots: [{ day: cell.dayKey, startMinutes: cell.startMinutes, endMinutes: cell.endMinutes }],
        // Période choisie (`periods`) : une réservation d'une AUTRE période ne gêne pas. Sans elle,
        // période inconnue = infinie, toute réservation du créneau le bloque (comportement historique).
        ...range,
      };
      const conflits = reservationConflicts(candidat, await freshReservations());
      if (conflits.length > 0) {
        setConflict(conflits[0].user || t("PreviewReservations.unknownUser"));
        return;
      }
      setConflict(null);
      setAdding({
        slot: { day: cell.dayKey, startMinutes: cell.startMinutes, endMinutes: cell.endMinutes },
        period: range ?? undefined,
      });
    },
    [freshReservations, me, openLogin, range, t],
  );

  const prefill = useMemo(
    () => (adding ? buildReservationPrefill(conf, { resourceId, resourceName, ...adding }) : null),
    [adding, conf, resourceId, resourceName],
  );

  // Contrôles de la saisie (`periods`), communs à tous les formulaires d'ajout : avertissement EN DIRECT sous
  // chaque créneau, puis refus d'ENREGISTRER rejoué sur ce que le formulaire envoie vraiment — heures modifiées,
  // créneaux ajoutés — contre les réservations RELUES de l'équipement ; après l'enregistrement, les fiches et le
  // filtre créneau se relisent (`afterSave`).
  const { beforeSubmit, slotCheck, afterSave } = useBookingChecks(conf);

  /* Grille à l'échelle horaire — remplace la grille en blocs empilés quand la
     prise de réservation est activée. Rendue MÊME sans réservation : c'est là
     qu'on crée la première. */
  /* `hidden md:block` : la grille horaire est un tableau de 46rem, illisible sous `md`.
     Elle ne remplace donc PLUS le repli mobile (liste groupée par jour), qui reste rendu
     en dessous de ce point de rupture — sans quoi un visiteur de téléphone n'avait plus
     qu'un tableau de 736 px à faire défiler latéralement dans le dialogue de fiche. */
  /* Cellules fusionnées verticalement (`mergeBookingRows`) : un créneau qui couvre plusieurs rangées
     n'est plus répété dans chacune, il occupe UNE cellule `rowSpan`, sa carte étirée sur toute la
     plage (`h-px` sur la cellule : ce qui permet à `h-full` de se résoudre dans un tableau). Une
     rangée absorbée (`covered`) ne rend pas de cellule ; les autres jours gardent les leurs. */
  const bookingGrid = booking ? (
    <div className="mt-6 hidden md:block">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] border-separate border-spacing-1 text-xs">
          <caption className="sr-only">{t("PreviewReservations.gridCaption")}</caption>
          <thead>
            <tr>
              <th scope="col" className="w-24 text-left font-medium text-muted-foreground">
                {t("PreviewReservations.hourColumn")}
              </th>
              {DAY_KEYS.map((day) => (
                <th
                  key={day}
                  scope="col"
                  className="rounded-md bg-muted/60 py-1 text-center font-semibold text-muted-foreground"
                >
                  {t(`days.${day}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.startMinutes}>
                <th scope="row" className="whitespace-nowrap pr-2 text-left font-normal text-muted-foreground">
                  {row.label}
                </th>
                {row.cells.map((cell) =>
                  cell.kind === "covered" ? null : cell.kind === "busy" ? (
                    <td key={cell.key} rowSpan={cell.rowSpan} className="h-px align-top">
                      <div className="flex h-full flex-col gap-1">
                        {cell.blocks.map((block) => (
                          <div key={block.key} className="min-h-0 flex-1">
                            <SlotBlock block={block} t={t} fill />
                          </div>
                        ))}
                      </div>
                    </td>
                  ) : (
                    <td key={cell.cell.key} className="align-top">
                      {canBook ? (
                        <FreeCell cell={cell.cell} t={t} onBook={handleBook} />
                      ) : (
                        <div className="h-full min-h-8 rounded-md border border-dashed border-border/40" />
                      )}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {t("PreviewReservations.referenceNotice")}
      </p>
      {conflict && (
        <p role="status" className="mt-2 text-xs font-medium text-destructive">
          {t("PreviewReservations.conflict", undefined, { user: conflict })}
        </p>
      )}
    </div>
  ) : null;

  return (
    <section className="rounded-2xl border border-border bg-card/70 p-5 shadow-sm">
      <div className="flex items-center gap-2 text-primary">
        <CalendarClock className="h-5 w-5" />
        <h2 className="text-base font-semibold">{t("PreviewReservations.title")}</h2>
        {groups.length > 0 && <Badge variant="secondary">{groups.length}</Badge>}
      </div>
      {/* Volume horaire en INDICATEURS (demande de Peterson du 23/10 : « bien visible », agrandis le 26/10),
          sablier pendant le chargement des réservations. */}
      {hours && (isLoading || groups.length > 0) && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-xl">
          <KpiCard
            icon="clock"
            label={t("PreviewReservations.kpiWeekly")}
            value={formatHours(hours.total.weeklyMinutes)}
            accentClasses="bg-chart-2/15 text-chart-2"
            loading={isLoading}
            loadingLabel={t("PreviewReservations.kpiLoading")}
            size="lg"
          />
          <KpiCard
            icon="calendar-clock"
            label={t("PreviewReservations.kpiCumulative")}
            value={formatHours(hours.total.cumulativeMinutes)}
            accentClasses="bg-chart-4/15 text-chart-4"
            loading={isLoading}
            loadingLabel={t("PreviewReservations.kpiLoading")}
            size="lg"
          />
        </div>
      )}

      {periods && (
        <PeriodFilter {...periodFilter} t={t} />
      )}

      {isLoading ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      ) : isError ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("PreviewReservations.error")}</p>
      ) : groups.length === 0 ? (
        <>
          {/* Des réservations existent, mais aucune sur la période choisie : « aucune réservation
              enregistrée » serait faux. */}
          <p className="mt-4 text-sm text-muted-foreground">
            {(data?.length ?? 0) > 0 ? t("PreviewReservations.emptyPeriod") : t("PreviewReservations.empty")}
          </p>
          {bookingGrid}
        </>
      ) : (
        <>
          {/* Usagers — la rangée (pastille couleur + nom en texte) tient aussi
              lieu de légende de la grille hebdo. */}
          {/* Clé par IDENTIFIANT d'abord : depuis le regroupement en deux passes, la clé de groupe
              est `userId` — deux clubs HOMONYMES (même nom, ids différents) forment donc deux
              groupes au `user` identique. Sans ce repli, clés React et `value` de Radix étaient
              dupliquées : un clic ouvrait les deux fiches à la fois. */}
          <Accordion type="multiple" className="mt-4">
            {groups.map((g, gi) => (
              <AccordionItem
                key={g.userId || g.user || "__unknown"}
                value={g.userId || g.user || "__unknown"}
              >
                {/* Le lien vers la fiche du club ne peut pas vivre DANS le déclencheur
                    (un bouton dans un bouton est du HTML invalide, et le clic replierait
                    l'accordéon) : grille à deux colonnes — déclencheur, puis lien. */}
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <AccordionTrigger className="gap-3 hover:no-underline">
                    <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: reservationColor(g.colorIndex) }}
                      />
                      <span className="truncate font-medium text-foreground">
                        {g.user || t("PreviewReservations.unknownUser")}
                      </span>
                      {g.activities.slice(0, 2).map((activity) => (
                        <Badge key={activity} variant="outline" className="hidden sm:inline-flex">
                          {activity}
                        </Badge>
                      ))}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {t("PreviewReservations.slotCount", undefined, { count: g.slotCount })}
                    </span>
                  </AccordionTrigger>
                  {/* Réservé aux groupes rattachés PAR IDENTIFIANT : un nom saisi à la
                      main ne désigne aucune fiche de façon sûre (homonymes, clubs absents
                      de l'annuaire) — sans identifiant, pas de bouton. */}
                  {orgaLink && g.userId && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 gap-1.5 px-2 text-xs"
                    >
                      <Link
                        to={`${orgaLink.path}?${orgaLink.previewParam ?? DEFAULT_PREVIEW_PARAM}=${encodeURIComponent(g.userId)}`}
                        aria-label={t("PreviewReservations.orgaSheetAria", undefined, {
                          name: g.user || t("PreviewReservations.unknownUser"),
                        })}
                      >
                        <Building2 className="h-3 w-3" aria-hidden />
                        {t("PreviewReservations.orgaSheet")}
                      </Link>
                    </Button>
                  )}
                  {/* Volume horaire puis périodes du club, sur LEURS lignes sous la rangée, alignés sur
                      le nom (pastille + écart = 1.125rem) : rangés à droite avec le nombre de créneaux,
                      ils écrasaient le nom et passaient sous le bouton « Fiche » en mobile. `-mt-5`
                      les rapproche du nom à travers le `py-4` du déclencheur. */}
                  {(hours || (periodsByGroup && periodsByGroup[gi].length > 0)) && (
                    <div className="col-span-2 -mt-5 space-y-0.5 pb-4 pl-[1.125rem] text-xs text-muted-foreground">
                      {hours && <p>{formatReservationHours(hours.byGroup[gi], t)}</p>}
                      {periodsByGroup && periodsByGroup[gi].length > 0 && (
                        <p>{periodsByGroup[gi].map((p) => formatReservationPeriod(p, t)).join(" · ")}</p>
                      )}
                    </div>
                  )}
                </div>
                <AccordionContent>
                  <div className="space-y-3 pl-5">
                    {g.reservations.map((r, ri) => (
                      <div
                        key={r.id || `res-${ri}`}
                        className="rounded-lg border border-border/60 bg-background/60 p-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          {r.activity && <span className="font-medium">{r.activity}</span>}
                          {r.bookingType && <Badge variant="secondary">{r.bookingType}</Badge>}
                        </div>
                        {(r.periodStart || r.periodEnd) && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatReservationPeriod(r, t)}
                          </p>
                        )}
                        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                          {r.slots.map((s, i) => {
                            // Période propre du créneau (un cycle de la saison), seulement quand elle
                            // diffère de celle de la réservation, affichée juste au-dessus.
                            const own = ownSlotPeriod(s, r);
                            return (
                              <li key={i} className="flex items-center gap-1">
                                <span>
                                  <span className="font-medium text-foreground">
                                    {t(`days.${s.day}`)}
                                  </span>{" "}
                                  {s.start} – {s.end}
                                  {own && ` · ${formatReservationPeriod(own, t)}`}
                                </span>
                                {/* Index brut ET identifiant de réponse : sans eux, rien à viser. */}
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
                    {/* Ajout d'un créneau à CE club sur CET équipement, comme depuis la fiche du club : les
                        deux finders verrouillés. Réservé aux groupes rattachés PAR IDENTIFIANT — un nom saisi
                        à la main ne désigne aucune organisation à pré-remplir. */}
                    {canBook && g.userId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 px-2 text-xs"
                        onClick={() => {
                          if (!me) openLogin();
                          else if (g.userId) setAdding({ orga: { id: g.userId, name: g.user } });
                        }}
                        aria-label={t("PreviewReservations.addSlotAria", undefined, {
                          name: g.user || t("PreviewReservations.unknownUser"),
                        })}
                      >
                        <Plus className="h-3 w-3" aria-hidden />
                        {t("PreviewReservations.addSlot")}
                      </Button>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {bookingGrid}

          {/* Grille hebdo historique — ≥ md : 7 colonnes Lun→Dim, blocs empilés
              triés. Remplacée par la grille horaire quand `booking` est posé. */}
          {!booking && hasSlots && (
            <div className="mt-6 hidden gap-2 md:grid md:grid-cols-7">
              {grid.map((day) => (
                <div key={day.dayKey} className="min-w-0">
                  <div className="rounded-md bg-muted/60 py-1 text-center text-xs font-semibold text-muted-foreground">
                    {t(`days.${day.dayKey}`)}
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {day.blocks.map((block) => (
                      <SlotBlock key={block.key} block={block} t={t} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Repli mobile — liste groupée par jour (jours vides omis). */}
          {/* Repli mobile — rendu AUSSI quand `booking` est posé : la grille horaire est
              masquée sous `md`, ce repli est alors la seule vue des créneaux. */}
          {hasSlots && (
            <div className="mt-6 space-y-4 md:hidden">
              {grid
                .filter((day) => day.blocks.length > 0)
                .map((day) => (
                  <div key={day.dayKey}>
                    <h3 className="text-sm font-semibold">{t(`days.${day.dayKey}`)}</h3>
                    <div className="mt-1.5 space-y-1.5">
                      {day.blocks.map((block) => (
                        <SlotBlock key={block.key} block={block} t={t} />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </>
      )}

      {prefill && (
        <Suspense fallback={null}>
          {/* `elementId`/`elementType` QUALIFIENT LE BROUILLON, et ce n'est pas optionnel ici :
              `useCoFormDraft` range l'autosave sous `coform-draft:v1:<form>:<user>:new`, sans segment
              élément quand on ne les passe pas. Le formulaire étant partagé par tous les équipements
              du site, un brouillon abandonné sur le gymnase A se proposerait à la réouverture sur le
              boulodrome B — et « Reprendre » écraserait le finder PRÉ-REMPLI ET VERROUILLÉ, posant la
              réservation sur le mauvais équipement sans que rien ne le signale. Même idiome que
              `PlaceFormView`. */}
          {/* `hideStepHeaders` : un formulaire d'une seule étape n'a que faire de « Étape 1 ». Pas de
              période par créneau (`slotPeriods`) : depuis l'import par période (23/10), une réservation
              vaut pour UNE période — Date début / Date fin —, une autre période est une autre réservation. */}
          <CoFormModal
            formId={conf.form}
            open
            onOpenChange={(next) => { if (!next) { setAdding(null); setConflict(null); } }}
            title={
              adding?.orga
                ? t("PreviewReservations.addSlotTitle", undefined, {
                  name: adding.orga.name || t("PreviewReservations.unknownUser"),
                })
                : t("PreviewReservations.bookTitle")
            }
            defaultValues={prefill.defaultValues}
            lockedFields={prefill.lockedFields}
            elementId={resourceId}
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
