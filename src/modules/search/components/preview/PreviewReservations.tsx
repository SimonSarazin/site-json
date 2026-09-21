import { Suspense, lazy, useCallback, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Plus } from "lucide-react";
import getDateFnsLocale from "@/dateFns";
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
import { useProfilPermissions } from "@/modules/profil/hooks/useProfilPermissions";
import { SEARCH_QUERY_KEYS } from "../../constants/queryKeys";
import { useReservationsQuery } from "../../hooks/useReservationsQuery";
import { DAY_KEYS, type DayKey } from "../../lib/schedules";
import {
  buildBookingGrid,
  buildWeeklyGrid,
  groupReservationsByUser,
  reservationColor,
  reservationConflicts,
  type BookingCell,
  type WeeklySlotBlock,
} from "../../lib/reservations";
import { buildReservationPrefill } from "../../lib/reservationPrefill";
import type { ReservationsConf } from "../../schema";

// Modale CoForm en lazy : le chunk coform ne doit être tiré qu'à la première
// demande de réservation, jamais à l'affichage de la fiche.
const CoFormModal = lazy(() => import("@/modules/coform/components/CoFormModal"));

type Translate = ReturnType<typeof useT>;

/** "2026-01-01" → "1 janv. 2026" (locale) ; repli sur l'ISO brut si invalide. */
function formatIsoDate(iso: string): string {
  // `parseISO` traite une date-only ("2026-01-01") comme minuit LOCAL, alors que
  // `new Date(iso)` la parse en UTC → recul d'un jour aux offsets UTC négatifs.
  const date = parseISO(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return format(date, "d MMM yyyy", { locale: getDateFnsLocale() });
}

function formatPeriod(
  { periodStart, periodEnd }: { periodStart?: string; periodEnd?: string },
  t: Translate,
): string {
  const start = periodStart ? formatIsoDate(periodStart) : undefined;
  const end = periodEnd ? formatIsoDate(periodEnd) : undefined;
  if (start && end) return t("PreviewReservations.period", undefined, { start, end });
  if (start) return t("PreviewReservations.periodFrom", undefined, { start });
  return t("PreviewReservations.periodUntil", undefined, { end });
}

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
 * n'est qu'une barre latérale : l'identité reste portée par le texte.
 */
function SlotBlock({ block, t }: { block: WeeklySlotBlock; t: Translate }) {
  const userLabel = block.user || t("PreviewReservations.unknownUser");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full rounded-md border border-border border-l-4 bg-card px-2 py-1.5 text-left text-xs shadow-sm transition-colors hover:bg-accent"
          style={{ borderLeftColor: reservationColor(block.colorIndex) }}
        >
          <span className="block font-semibold text-foreground">
            {block.start} – {block.end}
          </span>
          <span className="block truncate text-muted-foreground">{userLabel}</span>
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
          <DetailRow label={t("PreviewReservations.periodLabel")} value={formatPeriod(block, t)} />
        )}
        <DetailRow label={t(`days.${block.dayKey}`)} value={`${block.start} – ${block.end}`} />
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

  const groups = useMemo(() => groupReservationsByUser(data ?? []), [data]);
  const grid = useMemo(() => buildWeeklyGrid(groups), [groups]);
  const hasSlots = grid.some((day) => day.blocks.length > 0);

  /* ── Prise de réservation (opt-in `conf.booking`) ───────────────────────── */
  const booking = conf.booking;
  const { me, entity } = useCocolight();
  const { openLogin } = useAuthModal();
  const permissions = useProfilPermissions(entity || null);
  const queryClient = useQueryClient();
  const [slot, setSlot] = useState<{ day: DayKey; startMinutes: number; endMinutes: number } | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  // Réserver est réservé aux admins de l'entité du site par défaut : aucun
  // contrôle serveur ne vérifie aujourd'hui QUI réserve POUR QUI.
  const canBook = Boolean(booking) && (booking?.adminOnly === false || permissions.isAdmin);

  const rows = useMemo(
    () => (booking ? buildBookingGrid(grid, booking) : []),
    [booking, grid],
  );

  const handleBook = useCallback(
    (cell: BookingCell) => {
      if (!me) {
        openLogin();
        return;
      }
      // Garde de fraîcheur : la grille peut dater d'avant une réservation
      // concurrente. On revérifie le candidat contre les données chargées.
      const conflits = reservationConflicts(
        { slots: [{ day: cell.dayKey, startMinutes: cell.startMinutes, endMinutes: cell.endMinutes }] },
        data ?? [],
      );
      if (conflits.length > 0) {
        setConflict(conflits[0].user || t("PreviewReservations.unknownUser"));
        return;
      }
      setConflict(null);
      setSlot({ day: cell.dayKey, startMinutes: cell.startMinutes, endMinutes: cell.endMinutes });
    },
    [data, me, openLogin, t],
  );

  const prefill = useMemo(
    () => (slot ? buildReservationPrefill(conf, { resourceId, resourceName, slot }) : null),
    [conf, resourceId, resourceName, slot],
  );

  // `useCoFormFinalMutation` n'invalide que les caches coform : la liste des
  // réservations de CETTE ressource doit être rafraîchie explicitement.
  const handleSaved = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: SEARCH_QUERY_KEYS.RESERVATIONS(conf.form, resourceId),
    });
  }, [conf.form, queryClient, resourceId]);

  /* Grille à l'échelle horaire — remplace la grille en blocs empilés quand la
     prise de réservation est activée. Rendue MÊME sans réservation : c'est là
     qu'on crée la première. */
  const bookingGrid = booking ? (
    <div className="mt-6">
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
                {row.cells.map((cell) => (
                  <td key={cell.key} className="align-top">
                    {cell.blocks.length > 0 ? (
                      <div className="space-y-1">
                        {cell.blocks.map((block) => (
                          <SlotBlock key={block.key} block={block} t={t} />
                        ))}
                      </div>
                    ) : canBook ? (
                      <FreeCell cell={cell} t={t} onBook={handleBook} />
                    ) : (
                      <div className="h-full min-h-8 rounded-md border border-dashed border-border/40" />
                    )}
                  </td>
                ))}
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
          <p className="mt-4 text-sm text-muted-foreground">{t("PreviewReservations.empty")}</p>
          {bookingGrid}
        </>
      ) : (
        <>
          {/* Usagers — la rangée (pastille couleur + nom en texte) tient aussi
              lieu de légende de la grille hebdo. */}
          <Accordion type="multiple" className="mt-4">
            {groups.map((g) => (
              <AccordionItem key={g.user || "__unknown"} value={g.user || "__unknown"}>
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
                            {formatPeriod(r, t)}
                          </p>
                        )}
                        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                          {r.slots.map((s, i) => (
                            <li key={i}>
                              <span className="font-medium text-foreground">
                                {t(`days.${s.day}`)}
                              </span>{" "}
                              {s.start} – {s.end}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
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
          {!booking && hasSlots && (
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
          <CoFormModal
            formId={conf.form}
            open
            onOpenChange={(next) => { if (!next) setSlot(null); }}
            title={t("PreviewReservations.bookTitle")}
            defaultValues={prefill.defaultValues}
            lockedFields={prefill.lockedFields}
            onAfterSubmit={handleSaved}
          />
        </Suspense>
      )}
    </section>
  );
}
