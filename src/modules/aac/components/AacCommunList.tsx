import { useNavigate } from "react-router";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { ArrowRight } from "lucide-react";
import "../i18n";

/**
 * Form réellement passée par AacConfigStub (issue de `fundingData.rawEnvelope.projects`,
 * cf. useCagnotteAdapter's RawProposition) — PAS un CoFormAnswerSummary. Stub provisoire :
 * ce type sera à revoir quand ce composant sortira de sa phase socle.
 */
interface AacCommunListItem {
    id: string;
    titre?: string | null;
    projectId?: string | null;
    actions?: unknown[];
}

interface AacCommunListProps {
    formName?: string;
    communs: AacCommunListItem[];
    isLoading?: boolean;
}

/**
 * Liste simple des communs (réponses AAC) qui permet la navigation vers /commun/{answerId}.
 */
export function AacCommunList({
                                  formName,
                                  communs,
                                  isLoading = false,
                              }: AacCommunListProps) {
    useLoadNamespace("modules/aac");
    const t = useT("modules/aac");
    const navigate = useNavigate();
    if (isLoading) {
        return (
            <div className="max-w-2xl w-full mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="rounded-2xl border border-border bg-card shadow-lg p-6">
                    <p className="text-sm text-muted-foreground text-center">
                        {t("page.loading")}
                    </p>
                </div>
            </div>
        );
    }

    if (!communs || communs.length === 0) {
        return (
            <div className="max-w-2xl w-full mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="rounded-2xl border border-border bg-card shadow-lg p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                        {t("page.noCommunAvailable")}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl w-full mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
                {/* En-tête */}
                <div className="px-6 py-6 bg-primary/5 border-b border-border">
                    <h2 className="text-xl font-bold text-foreground">
                        {t("page.communTitle")}
                    </h2>
                    {formName && (
                        <p className="text-sm text-muted-foreground mt-1">{formName}</p>
                    )}
                    <p className="text-sm text-muted-foreground mt-2">
                        {t("page.communCount", undefined, { count: communs.length })}
                    </p>
                </div>

                {/* Liste des communs */}
                <div className="divide-y divide-border">
                    {communs.map((commun) => {

                        const actionsCount: number = commun.projectId ? (commun.actions?.length ?? 0) : 0;

                        return (
                            <button
                                key={commun.id}
                                type="button"
                                onClick={() => navigate(`/commun/${commun.id}`)}
                                className="w-full px-6 py-4 text-left hover:bg-muted/50 transition-colors group"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-medium text-foreground">
                                            {commun.titre || t("page.communNoName")}
                                            </span>
                                            <span className="text-sm font-medium text-foreground">
                                            {actionsCount}
                                            </span>
                                        </div>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                                </div>
                            </button>   
                        )
                    })}
                </div>
            </div>
        </div>
    );
}