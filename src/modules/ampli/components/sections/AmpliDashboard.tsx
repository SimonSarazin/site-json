import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import { Heart, MessageCircle, Tag, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientOnly } from "@/components/layout/ClientOnly";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import type { AmpliDataResponse } from "../../types";
import type { AmpliTopAnswer } from "../../utils/dashboardStats";
import { getDashboardStats } from "../../utils/dashboardStats";

interface AmpliDashboardProps {
    data: AmpliDataResponse[];
    /** Périmètre encore en cours de chargement : chiffres en squelette. */
    isLoading?: boolean;
}

/* Palette catégorielle du THÈME du site (`--chart-1..5`, cf. observatoire) :
   jamais d'hex, les couleurs suivent le clair/sombre de chaque site. */
const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"] as const;

/* Dimensions AVANT la 1ʳᵉ mesure : évite le warn recharts « width(0) and
   height(0) » ; la largeur est recalée par le ResizeObserver. */
const CHART_INITIAL_DIMENSION = { width: 600, height: 320 };

function KpiCard({ icon, value, label, hint, accent, isLoading }: {
    icon: React.ReactNode;
    value: number;
    label: string;
    hint: string;
    accent: string;
    isLoading: boolean;
}) {
    return (
        <Card className="gap-0 rounded-2xl border-border/50 py-5 transition-shadow hover:shadow-md">
            <CardContent className="px-5">
                <div className={`mb-4 w-fit rounded-xl p-2.5 ${accent}`}>{icon}</div>
                {isLoading ? (
                    <Skeleton className="h-9 w-12" />
                ) : (
                    <p className="text-3xl font-bold tabular-nums text-foreground">{value}</p>
                )}
                <p className="mt-2 text-sm font-semibold text-foreground">{label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
            </CardContent>
        </Card>
    );
}

function TopAnswers({ title, icon, accent, entries, unit, emptyLabel, anonymousLabel, untitledLabel }: {
    title: string;
    icon: React.ReactNode;
    accent: string;
    entries: AmpliTopAnswer[];
    unit: React.ReactNode;
    emptyLabel: string;
    anonymousLabel: string;
    untitledLabel: string;
}) {
    return (
        <Card className="gap-0 rounded-2xl border-border/50 py-5">
            <CardContent className="px-5">
                <h3 className="mb-4 flex items-center gap-2 border-b border-border pb-3 text-sm font-semibold uppercase tracking-wider text-foreground">
                    <span className={accent}>{icon}</span>
                    {title}
                </h3>
                {entries.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
                ) : (
                    <ol className="space-y-2">
                        {entries.map((entry, index) => (
                            // `id` peut être vide (réponse sans `_id` exploitable) : le rang
                            // complète la clé, un même id ne pouvant occuper deux rangs.
                            <li
                                key={`${entry.id}-${index}`}
                                className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5"
                            >
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary tabular-nums">
                                    {index + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-foreground">
                                        {entry.name || untitledLabel}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {entry.author || anonymousLabel}
                                    </p>
                                </div>
                                <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${accent}`}>
                                    {unit}
                                    {entry.count}
                                </span>
                            </li>
                        ))}
                    </ol>
                )}
            </CardContent>
        </Card>
    );
}

/**
 * Tab « Statistiques » — vision globale des données de la communauté :
 * compteurs, classements des réponses, répartition des tags.
 *
 * Consomme le MÊME périmètre de réponses que les autres tabs (une seule query
 * dans `AmpliSectionRenderer`) : aucun appel réseau supplémentaire.
 */
export default function AmpliDashboard({ data, isLoading = false }: AmpliDashboardProps) {
    useLoadNamespace("modules/ampli");
    const t = useT("modules/ampli");

    // `data` est un tableau recréé à chaque rendu par le renderer : sans mémo,
    // l'agrégation (et le modèle du graphe) repartirait de zéro à chaque fois.
    const stats = useMemo(() => getDashboardStats(data ?? []), [data]);

    const anonymousLabel = String(t("MeeteemSection.card.noUser"));
    const untitledLabel = String(t("AmpliDashboard.untitled"));

    return (
        <section
            id="ampli-dashboard-section"
            className="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8"
        >
            <div className="my-4 text-center sm:my-6 md:my-10">
                <h2 className="mb-4 text-3xl font-bold text-balance text-foreground sm:mb-6 sm:text-4xl md:text-5xl">
                    {t("AmpliDashboard.headline")}
                </h2>
                <p className="mx-auto max-w-3xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg md:text-xl">
                    {t("AmpliDashboard.subhead")}
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    icon={<Users className="h-5 w-5" />}
                    value={stats.participants}
                    label={String(t("AmpliDashboard.kpi.participants"))}
                    hint={String(t("AmpliDashboard.kpi.participantsHint"))}
                    accent="bg-chart-1/15 text-chart-1"
                    isLoading={isLoading}
                />
                <KpiCard
                    icon={<MessageCircle className="h-5 w-5" />}
                    value={stats.comments}
                    label={String(t("AmpliDashboard.kpi.comments"))}
                    hint={String(t("AmpliDashboard.kpi.commentsHint"))}
                    accent="bg-chart-2/15 text-chart-2"
                    isLoading={isLoading}
                />
                <KpiCard
                    icon={<Heart className="h-5 w-5" />}
                    value={stats.likes}
                    label={String(t("AmpliDashboard.kpi.likes"))}
                    hint={String(t("AmpliDashboard.kpi.likesHint"))}
                    accent="bg-chart-3/15 text-chart-3"
                    isLoading={isLoading}
                />
                <KpiCard
                    icon={<Tag className="h-5 w-5" />}
                    value={stats.tagsUsed}
                    label={String(t("AmpliDashboard.kpi.tags"))}
                    hint={String(t("AmpliDashboard.kpi.tagsHint"))}
                    accent="bg-chart-4/15 text-chart-4"
                    isLoading={isLoading}
                />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <TopAnswers
                    title={String(t("AmpliDashboard.topLiked"))}
                    icon={<Heart className="h-4 w-4" />}
                    accent="bg-chart-3/15 text-chart-3"
                    entries={stats.topLiked}
                    unit={<Heart className="h-3 w-3" />}
                    emptyLabel={String(t("AmpliDashboard.emptyRanking"))}
                    anonymousLabel={anonymousLabel}
                    untitledLabel={untitledLabel}
                />
                <TopAnswers
                    title={String(t("AmpliDashboard.topCommented"))}
                    icon={<MessageCircle className="h-4 w-4" />}
                    accent="bg-chart-2/15 text-chart-2"
                    entries={stats.topCommented}
                    unit={<MessageCircle className="h-3 w-3" />}
                    emptyLabel={String(t("AmpliDashboard.emptyRanking"))}
                    anonymousLabel={anonymousLabel}
                    untitledLabel={untitledLabel}
                />
            </div>

            <Card className="mt-6 gap-0 rounded-2xl border-border/50 py-5">
                <CardContent className="px-5">
                    <h3 className="mb-4 border-b border-border pb-3 text-sm font-semibold uppercase tracking-wider text-foreground">
                        {String(t("AmpliDashboard.tagsChart"))}
                    </h3>
                    {stats.tags.length === 0 ? (
                        <p className="py-10 text-center text-sm text-muted-foreground">
                            {String(t(isLoading ? "a11y.loading" : "AmpliDashboard.emptyTags"))}
                        </p>
                    ) : (
                        <div className="h-80">
                            {/* CLIENT-ONLY : recharts ne s'hydrate pas (ids clipPath issus
                                d'un compteur global serveur≠client, mesure de texte des
                                ticks impossible côté serveur) — cf. observatoire. */}
                            <ClientOnly fallback={<Skeleton className="h-full w-full rounded-md" />}>
                                {() => (
                                    <ChartContainer
                                        config={{}}
                                        className="aspect-auto h-full w-full"
                                        initialDimension={CHART_INITIAL_DIMENSION}
                                    >
                                        <BarChart data={stats.tags} margin={{ top: 20, right: 8, bottom: 48, left: 0 }}>
                                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                            <XAxis
                                                dataKey="name"
                                                interval={0}
                                                angle={-35}
                                                textAnchor="end"
                                                height={60}
                                                tickLine={false}
                                                tick={{ fontSize: 11 }}
                                            />
                                            <YAxis allowDecimals={false} width={40} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                                            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                                            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={72}>
                                                <LabelList dataKey="value" position="top" className="fill-muted-foreground" fontSize={11} />
                                                {stats.tags.map((tag, index) => (
                                                    <Cell key={tag.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ChartContainer>
                                )}
                            </ClientOnly>
                        </div>
                    )}
                </CardContent>
            </Card>
        </section>
    );
}
