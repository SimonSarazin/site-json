import { useMemo, type ReactNode } from "react";
import { Link } from "react-router";
import { CalendarDays } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/modules/search/i18n";
import { useCommunProjectEvents, type CommunEventsBucket } from "@/modules/aac/hooks/useCommunProjectEvents";
import { toCommunEventRow } from "@/modules/aac/lib/communEvents";
import { SectionBodySkeleton } from "./CommunSkeletons";

interface CommunAgendaSectionProps {
    /** Le projet du commun. Absent = la section n'a pas lieu d'être affichée. */
    projectId?: string | null;
}

function NoticeBox({ children }: { children: ReactNode }) {
    return (
        <div className="p-4 rounded-lg border border-border bg-surface/60">
            <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>
        </div>
    );
}

/** Un flux d'événements du projet (à venir ou passés), paginé par « Voir plus ». */
function CommunEventList({ projectId, bucket }: { projectId: string; bucket: CommunEventsBucket }) {
    const t = useT("modules/aac");
    const tSearch = useT("modules/search");
    const { events, now, isLoading, isError, hasNextPage, isFetchingNextPage, fetchNextPage } =
        useCommunProjectEvents(projectId, bucket);
    const rows = useMemo(() => events.map((event) => toCommunEventRow(event, now, tSearch)), [events, now, tSearch]);

    let body: ReactNode;
    if (isLoading) {
        body = <SectionBodySkeleton rows={2} />;
    } else if (isError) {
        body = <NoticeBox>{String(t("detail.agendaSection.error"))}</NoticeBox>;
    } else if (rows.length === 0) {
        body = (
            <NoticeBox>
                {String(t(bucket === "upcoming" ? "detail.agendaSection.empty" : "detail.agendaSection.emptyPast"))}
            </NoticeBox>
        );
    } else {
        body = (
            <ul className="space-y-3">
                {rows.map((row) => {
                    const name = row.name || String(t("detail.noname"));
                    const meta = [row.when, row.locality].filter(Boolean).join(" · ");
                    return (
                        <li key={row.id} className="flex gap-3 rounded-lg border border-border bg-card p-4">
                            <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                            <div className="min-w-0">
                                <p className="font-medium">
                                    {row.slug ? (
                                        <Link to={`/profil/${row.slug}`} className="hover:underline">
                                            {name}
                                        </Link>
                                    ) : (
                                        name
                                    )}
                                </p>
                                {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
                                {row.isOngoing && (
                                    <Badge variant="secondary" className="mt-1.5 text-[10px]">
                                        {String(t("detail.agendaSection.ongoing"))}
                                    </Badge>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        );
    }

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">
                {String(t(`detail.agendaSection.${bucket}`))}
            </h3>
            {body}
            {hasNextPage && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void fetchNextPage()}
                    disabled={isFetchingNextPage}
                >
                    {String(t("detail.agendaSection.more"))}
                </Button>
            )}
        </div>
    );
}

/** L'agenda du projet d'un commun : événements à venir, puis passés. */
export function CommunAgendaSection({ projectId }: CommunAgendaSectionProps) {
    useLoadNamespace("modules/aac");
    useLoadNamespace("modules/search");

    if (!projectId) return null;

    return (
        <div className="space-y-6">
            <CommunEventList projectId={projectId} bucket="upcoming" />
            <CommunEventList projectId={projectId} bucket="past" />
        </div>
    );
}
