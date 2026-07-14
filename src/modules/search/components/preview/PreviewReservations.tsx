import { useMemo } from "react";
import { format } from "date-fns";
import { CalendarClock } from "lucide-react";
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
import { useReservationsQuery } from "../../hooks/useReservationsQuery";
import {
  buildWeeklyGrid,
  groupReservationsByUser,
  reservationColor,
  type WeeklySlotBlock,
} from "../../lib/reservations";
import type { ReservationsConf } from "../../schema";

type Translate = ReturnType<typeof useT>;

/** "2026-01-01" → "1 janv. 2026" (locale) ; repli sur l'ISO brut si invalide. */
function formatIsoDate(iso: string): string {
  const date = new Date(iso);
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

/**
 * Section « Réservations » du preview `poi-amenities` : usagers en accordion
 * (qui sert aussi de légende couleur) + grille hebdomadaire Lun→Dim (≥ md) ou
 * liste groupée par jour (mobile). Montée uniquement si le site configure
 * `preview.reservations` — chargée en lazy par `PreviewPoiAmenities`.
 */
export default function PreviewReservations({
  resourceId,
  conf,
}: {
  resourceId: string;
  conf: ReservationsConf;
}) {
  useLoadNamespace("modules/search");
  const t = useT("modules/search");
  const { data, isLoading, isError } = useReservationsQuery({ resourceId, conf });

  const groups = useMemo(() => groupReservationsByUser(data ?? []), [data]);
  const grid = useMemo(() => buildWeeklyGrid(groups), [groups]);
  const hasSlots = grid.some((day) => day.blocks.length > 0);

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
        <p className="mt-4 text-sm text-muted-foreground">{t("PreviewReservations.empty")}</p>
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
                    {g.reservations.map((r) => (
                      <div
                        key={r.id}
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

          {/* Grille hebdo — ≥ md : 7 colonnes Lun→Dim, blocs empilés triés. */}
          {hasSlots && (
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
    </section>
  );
}
