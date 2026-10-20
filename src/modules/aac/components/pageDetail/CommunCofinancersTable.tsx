import { useQueries } from "@tanstack/react-query";
import { Link } from "react-router";
import type { CoFormData, CoFormAnswer } from "@/modules/coform/types";
import type { FinderElementType } from "@/modules/coform/types";
import type { AacResolvedConfig } from "../../types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { toSafeInt, buildItemsFromRawDepenses, getEntityId } from "@/modules/cagnotte/utils/dataTransform";
import { formatCurrency, initials } from "@/modules/cagnotte/utils/format";
import { useCocolight } from "@/hooks/useCocolight";
import { useCommunRawDepenses } from "@/modules/aac/hooks/useCommunRawDepenses";
import { aggregateCofinancers } from "@/modules/aac/lib/cofinancers";
import { COFORM_QUERY_KEYS } from "@/modules/coform/constants/queryKeys";
import { ELEMENT_SUMMARY_STALE_TIME_MS, fetchElementSummary } from "@/modules/coform/hooks/useElementSummary";
import type { CagnotteResource } from "@/modules/cagnotte/types";
import { CofinancersRowsSkeleton, ListRowsSkeleton } from "./CommunSkeletons";

interface CommunCofinancersTableProps {
    formData: CoFormData;
    answerQuery: CoFormAnswer| null;
    aacConfig: AacResolvedConfig | null;
    funding?: CagnotteResource | null;
    /** `table` (défaut) : tableau partenaire / type / contribution. `list` : lignes sobres nom + type à gauche, montant à droite. */
    layout?: "table" | "list";
}

/**
 * La collection où lire la fiche d'un cofinanceur. Le backend écrit `"tl"`
 * (tiers-lieu), `"organization"` au singulier par défaut, ou rien ; seul le
 * paiement d'un citoyen pose `"citoyens"` (cf. `Aap::addFinancerEngagement`).
 */
const financerEntityType = (type: string): FinderElementType =>
    type === "citoyens" ? "citoyens" : "organizations";

export function CommunCofinancersTable({formData: _formData, answerQuery, aacConfig, funding, layout = "table"}: CommunCofinancersTableProps) {
    useLoadNamespace("modules/aac");
    const t = useT("modules/aac");
    const { entity, api } = useCocolight();
    const porteurId = entity?.id;

    const answerId = answerQuery ? getEntityId(answerQuery) : undefined;
    // Même étape que la carte et « Besoins financiers » : celle que la page a
    // résolue, pas `aapStep1` en dur.
    const { data: depenses, isLoading } = useCommunRawDepenses(answerId, aacConfig?.roles?.depenseStepKey ?? undefined);
    const items = buildItemsFromRawDepenses(depenses ?? [], funding?.items ?? []);

    // La MÊME agrégation que le compteur de la carte (`aggregateCofinancers`) :
    // une ligne sans `financerId` n'est plus écartée — elle était comptée dans
    // la carte et absente d'ici, les deux chiffres ne pouvaient pas se recouper.
    const aggregates = aggregateCofinancers(items);

    // Photo et slug ne sont pas dans la dépense, et `envelope.links` n'a pas de
    // slug : on lit la fiche, cache partagé avec les finders (`ELEMENT_SUMMARY`).
    // Une ligne sans `financerId` (doublonnage, saisie libre) n'a pas de fiche.
    const resolvable = aggregates.filter((agg) => !!agg.financerId);
    const summaries = useQueries({
        queries: resolvable.map((agg) => {
            const type = financerEntityType(agg.type);
            return {
                queryKey: COFORM_QUERY_KEYS.ELEMENT_SUMMARY(type, agg.financerId),
                enabled: !!api,
                staleTime: ELEMENT_SUMMARY_STALE_TIME_MS,
                queryFn: () => fetchElementSummary(api!, agg.financerId!, type),
            };
        }),
    });
    const summaryById = new Map(resolvable.map((agg, i) => [agg.financerId, summaries[i]?.data]));

    const cofinancersTotalsArray = aggregates.map((agg) => {
        const type = agg.type || String(t("detail.cofinancers.organizations"));
        const summary = agg.financerId ? summaryById.get(agg.financerId) : undefined;
        return {
            key: agg.key,
            name: agg.name || summary?.name || String(t("detail.cofinancers.unknownContributor")),
            type: type === "tl" ? String(t("detail.cofinancers.organizations")) : (type === "organizations" ? String(t("detail.cofinancers.organizations")) : type),
            featured: !!agg.financerId && porteurId === agg.financerId,
            totalAmount: agg.totalAmount,
            imageUrl: summary?.img,
            slug: summary?.slug,
        };
    });

    if (layout === "list") {
        if (cofinancersTotalsArray.length === 0) {
            return isLoading ? (
                <ListRowsSkeleton />
            ) : (
                <p className="text-sm text-muted-foreground">{String(t("detail.cofinancers.empty"))}</p>
            );
        }
        return (
            <ul className="divide-y divide-border">
                {cofinancersTotalsArray.map((c) => (
                    <li
                        key={c.key}
                        className={cn(
                            "flex items-center justify-between gap-3 py-2.5",
                            c.featured && "-mx-2 rounded-md bg-primary/5 px-2",
                        )}
                    >
                        <span className="flex min-w-0 items-center gap-2 text-sm">
                            <Avatar className="size-6 shrink-0 rounded-md">
                                <AvatarImage src={c.imageUrl} alt={c.name} className="object-cover" />
                                <AvatarFallback
                                    className={cn(
                                        "rounded-md text-[9px] font-bold",
                                        c.featured ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground",
                                    )}
                                >
                                    {initials(c.name)}
                                </AvatarFallback>
                            </Avatar>
                            {c.slug ? (
                                <Link to={`/profil/${c.slug}`} className="truncate hover:underline">
                                    {c.name}
                                </Link>
                            ) : (
                                <span className="truncate">{c.name}</span>
                            )}
                            <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">{c.type}</Badge>
                        </span>
                        <span className="shrink-0 font-medium tabular-nums">{formatCurrency(toSafeInt(c.totalAmount))}</span>
                    </li>
                ))}
            </ul>
        );
    }

    // « Aucun cofinanceur » seulement une fois les dépenses lues.
    if (cofinancersTotalsArray.length === 0 && !isLoading) {
        return (
            <div className="p-5 rounded-lg border border-border bg-surface/60">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    {String(t("detail.cofinancers.empty"))}
                </p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden border border-border rounded-lg">
            <table className="w-full text-left text-sm">
                <thead className="bg-surface/50">
                <tr className="border-b border-border">
                    <th className="py-3 px-4 font-bold text-muted-foreground text-[11px] uppercase tracking-wider">
                        {String(t("detail.cofinancers.partner"))}
                    </th>
                    <th className="py-3 px-4 font-bold text-muted-foreground text-[11px] uppercase tracking-wider hidden sm:table-cell">
                        {String(t("detail.cofinancers.type"))}
                    </th>
                    <th className="py-3 px-4 font-bold text-muted-foreground text-[11px] uppercase tracking-wider text-right">
                        {String(t("detail.cofinancers.contribution"))}
                    </th>
                </tr>
                </thead>
                <tbody className="divide-y divide-border">
                {cofinancersTotalsArray.length === 0 && isLoading ? (
                    <CofinancersRowsSkeleton />
                ) : null}
                {cofinancersTotalsArray.map((c) => (
                    <tr
                        key={c.key}
                        className={`hover:bg-surface/60 transition-colors ${c.featured ? "bg-primary/5" : ""}`}
                    >
                        <td className="py-3.5 px-4 font-medium">
                            <div className="flex items-center gap-3 min-w-0">
                                <Avatar className="size-8 shrink-0 rounded-md">
                                    <AvatarImage src={c.imageUrl} alt={c.name} className="object-cover" />
                                    <AvatarFallback
                                        className={`rounded-md text-[10px] font-bold ${
                                            c.featured
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-surface-2 text-muted-foreground"
                                        }`}
                                    >
                                        {initials(c.name)}
                                    </AvatarFallback>
                                </Avatar>
                                {c.slug ? (
                                    <Link to={`/profil/${c.slug}`} className="truncate hover:underline">
                                        {c.name}
                                    </Link>
                                ) : (
                                    <span className="truncate">{c.name}</span>
                                )}
                            </div>
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground hidden sm:table-cell">
                            {c.type}
                        </td>
                        <td className="py-3.5 px-4 text-right font-display font-bold tabular-nums">
                            {toSafeInt(c.totalAmount).toLocaleString("fr-FR")} €
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}
