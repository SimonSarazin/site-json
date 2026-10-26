import { Suspense, useMemo } from "react";
import { lazy } from "vite-preload";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { Lightbulb, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSummaryData } from "../../helpers/summary";
import { AMPLI_SECTION_IDS } from "../../constants/sectionIds";

// Le moteur de formulaire coform est LOURD : il ne doit pas peser sur le chunk
// de l'onglet home. Convention lazy du dépôt (`vite-preload`, export default,
// sous `<Suspense>`).
const AmpliIdeaForm = lazy(() => import("./parts/AmpliIdeaForm"));

interface AmpliFeaturesProps {
    /** Formulaire de l'ampli — celui qu'on propose de remplir. */
    coform: string;
    isLoading?: boolean;
    data: Parameters<typeof getSummaryData>[0];
}

export default function AmpliFeatures({ coform, isLoading, data }: AmpliFeaturesProps) {
    useLoadNamespace("modules/ampli");
    const t = useT("modules/ampli");

    // Agrégation de TOUT le périmètre (jusqu'à 5000 réponses) : mémoïsée comme
    // dans AmpliCommunity et AmpliDashboard, sinon elle est refaite à chaque
    // rendu de la section (chaque frappe du formulaire en ligne, notamment).
    const summaryData = useMemo(() => getSummaryData(data ?? []), [data]);

    // Les compteurs attendent le périmètre complet des réponses ; le formulaire,
    // lui, n'en dépend pas. On ne masque donc plus TOUTE la section pendant le
    // chargement (c'est ce qui laissait la colonne gauche vide) : seuls les
    // chiffres passent en squelette.
    const stat = (value: number, className: string) =>
        isLoading ? <Skeleton className="h-5 w-8" /> : <span className={className}>{value}</span>;

    return (
        // `scroll-mt-24` : cible d'ancre du hero, et les en-têtes de site peuvent
        // être `sticky` — sans marge, le titre de la section finirait dessous.
        <section
            id={AMPLI_SECTION_IDS.FEATURES}
            className="container mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24"
        >
            <div className="text-center my-4 sm:my-6 md:my-10">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground text-balance mb-4 sm:mb-6">
                    {t("AmpliFeatures.headline")}
                </h2>
                <p className="text-base sm:text-lg md:text-xl text-muted-foreground text-pretty max-w-3xl mx-auto leading-relaxed">
                    {t("AmpliFeatures.subhead")}
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                <div className="p-4 forms-container">
                    {/* Formulaire de proposition EN LIGNE : la section décrit le
                        geste attendu, le formulaire doit être immédiatement
                        remplissable — pas derrière un bouton. */}
                    <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
                        <AmpliIdeaForm
                            coformId={coform}
                            submitLabel={String(t("AmpliFeatures.button"))}
                        />
                    </Suspense>
                </div>
                <div className="space-y-6">
                    <Card className="p-6 bg-gradient-card border-primary/20">
                        <div className="flex items-center mb-4">
                            <Lightbulb className="h-6 w-6 text-primary mr-3" />
                            <h3 className="font-semibold text-foreground">{t("AmpliFeatures.howItWork.headline")}</h3>
                        </div>
                        <ol className="space-y-3 text-muted-foreground">
                            <li className="flex items-start">
                                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3 mt-0.5 shrink-0">1</span>
                                {t("AmpliFeatures.howItWork.stepOne")}
                            </li>
                            <li className="flex items-start">
                                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3 mt-0.5 shrink-0">2</span>
                                {t("AmpliFeatures.howItWork.stepTwo")}
                            </li>
                            <li className="flex items-start">
                                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3 mt-0.5 shrink-0">3</span>
                                {t("AmpliFeatures.howItWork.stepThree")}
                            </li>
                        </ol>
                    </Card>

                    <Card className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-foreground flex items-center">
                                <TrendingUp className="h-5 w-5 text-secondary mr-2" />
                                {t("AmpliFeatures.summary.headline")}
                            </h3>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">{t("AmpliFeatures.summary.submitted")}</span>
                                {stat(summaryData.totalAnswers, "font-semibold text-foreground")}
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">{t("AmpliFeatures.summary.members")}</span>
                                {stat(summaryData.totalUsers, "font-semibold text-foreground")}
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">{t("AmpliFeatures.summary.amplified")}</span>
                                {stat(summaryData.totalLikes, "font-semibold text-secondary")}
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">{t("AmpliFeatures.summary.comments")}</span>
                                {stat(summaryData.totalComments, "font-semibold text-secondary")}
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </section>
    );
}
