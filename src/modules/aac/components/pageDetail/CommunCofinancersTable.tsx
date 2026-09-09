import type { CoFormData, CoFormAnswer } from "@/modules/coform/types";
import type { AacResolvedConfig } from "../../types";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { toSafeInt, buildItemsFromRawDepenses, getEntityId } from "@/modules/cagnotte/utils/dataTransform";
import { useCocolight } from "@/hooks/useCocolight";
import { useCommunRawDepenses } from "@/modules/aac/hooks/useCommunRawDepenses";
import { aggregateCofinancers } from "@/modules/aac/lib/cofinancers";
import type { CagnotteResource } from "@/modules/cagnotte/types";

interface CommunCofinancersTableProps {
    formData: CoFormData;
    answerQuery: CoFormAnswer| null;
    aacConfig: AacResolvedConfig | null;
    funding?: CagnotteResource | null;
}

export function CommunCofinancersTable({formData: _formData, answerQuery, aacConfig, funding}: CommunCofinancersTableProps) {
    useLoadNamespace("modules/aac");
    const t = useT("modules/aac");
    const { entity } = useCocolight();
    const porteurId = entity?.id;

    const answerId = answerQuery ? getEntityId(answerQuery) : undefined;
    // Même étape que la carte et « Besoins financiers » : celle que la page a
    // résolue, pas `aapStep1` en dur.
    const { data: depenses } = useCommunRawDepenses(answerId, aacConfig?.roles?.depenseStepKey ?? undefined);
    const items = buildItemsFromRawDepenses(depenses ?? [], funding?.items ?? []);

    // La MÊME agrégation que le compteur de la carte (`aggregateCofinancers`) :
    // une ligne sans `financerId` n'est plus écartée — elle était comptée dans
    // la carte et absente d'ici, les deux chiffres ne pouvaient pas se recouper.
    const cofinancersTotalsArray = aggregateCofinancers(items).map((agg) => {
        const type = agg.type || String(t("detail.cofinancers.organizations"));
        return {
            key: agg.key,
            name: agg.name || String(t("detail.cofinancers.unknownContributor")),
            type: type === "tl" ? String(t("detail.cofinancers.organizations")) : type,
            featured: !!agg.financerId && porteurId === agg.financerId,
            totalAmount: agg.totalAmount,
        };
    });

    if(cofinancersTotalsArray.length === 0) {
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
                {cofinancersTotalsArray.map((c) => (
                    <tr
                        key={c.key}
                        className={`hover:bg-surface/60 transition-colors ${c.featured ? "bg-primary/5" : ""}`}
                    >
                        <td className="py-3.5 px-4 font-medium">
                            <div className="flex items-center gap-3 min-w-0">
                                <div
                                    className={`size-8 shrink-0 rounded-md grid place-items-center text-[10px] font-bold ${
                                        c.featured
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-surface-2 text-muted-foreground"
                                    }`}
                                >
                                    {c.name
                                        .split(" ")
                                        .slice(0, 2)
                                        .map((w) => w[0])
                                        .join("")}
                                </div>
                                <span className="truncate">{c.name}</span>
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