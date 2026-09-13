import { useMemo } from "react";
import { lazy } from "vite-preload";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { AmpliConfig } from "./schema";
import { useFetchAnswerQuery } from "./hooks/useFetchAnswerQuery";
import { AmpliDataResponse } from "./helpers/summary";
import AmpliCommunity from "./components/sections/AmpliCommunity";

interface AmpliSectionRendererProps {
    activeTab: string;
    config: AmpliConfig["props"];
}

const AmpliHeader = lazy(() => import("./components/sections/AmpliHeader"));
const AmpliIntro = lazy(() => import("./components/sections/AmpliIntro"));
const AmpliFeatures = lazy(() => import("./components/sections/AmpliFeatures"));
const AmpliMessages = lazy(() => import("./components/sections/AmpliMessages"));
const AmpliDashboard = lazy(() => import("./components/sections/AmpliDashboard"));


export function AmpliSectionRenderer({ activeTab, config }: AmpliSectionRendererProps) {
    useLoadNamespace("modules/ampli");
    const t = useT("modules/ampli");
    // MÉMOÏSÉS — ces deux objets entrent dans la queryKey ET dans les deps du
    // `useMemo` qui transforme les résultats. En littéral inline, ils changeaient
    // d'identité à chaque rendu : `transformedResults` était un tableau NEUF à
    // chaque fois, ce qui invalidait en cascade toutes les mémoïsations en aval
    // (agrégation des contributeurs, modèle carto, index de clustering, mémo de
    // chaque marqueur). Même précaution que `MeeteemSection`.
    const baseParams = useMemo(() => ({
        indexStepList: 6,
        indexStepMap: 0,
        defaultFilters: {
            form: config.coform,
            finderPath: config.path.finder || "",
            ...(
                config.path.name != "" ? {
                    [`answers.${config.path.name}`]: {
                        '$exists': true
                    }
                } : {}
            )
        },
        defaultFields: [
            ...(Object.values(config.path).map((value) => `answers.${value}`)),
            "user",
            "vote",
            "voteCount"
        ],
        defaultSortBy: {
            created: -1 as const
        }
    }), [config.coform, config.path]);

    const extractionConfig = useMemo(() => ({
        dataPath: config.path,
        prefix: "answers",
        includeUserInfo: true
    }), [config.path]);

    const {
        transformedResults,
        isLoading,
        isPending,
        error
    } = useFetchAnswerQuery({
        coformId: config.coform,
        view: "map",
        baseParams,
        extractionConfig
    });

    switch (activeTab) {
        case "home":
            return (
                <>
                    <AmpliHeader props={config.hero} />
                    <AmpliIntro props={config.intro} />
                    <AmpliFeatures props={config.features} coform={config.coform} isLoading={isLoading} data={transformedResults as AmpliDataResponse[]} />
                    <AmpliMessages props={config.message} coform={config.coform} path={config.path} />
                </>
            );
        case "community":
            return (
                <AmpliCommunity
                    props={config.community}
                    data={transformedResults as AmpliDataResponse[]}
                    isLoading={isLoading}
                    isPending={isPending}
                    isError={Boolean(error)}
                />
            );
        case "stats":
            return (
                <AmpliDashboard
                    props={config.dashboard}
                    data={transformedResults as AmpliDataResponse[]}
                    isLoading={isLoading || isPending}
                />
            );
        case "news":
            // Route déclarée dans routes.tsx mais section pas encore implémentée.
            // Fallback UI explicite plutôt que `null` silencieux.
            return (
                <div className="container mx-auto px-4 py-16 text-center">
                    <h2 className="text-2xl font-semibold mb-3 text-foreground">
                        {String(t("AmpliTemplateDefault.comingSoon.title"))}
                    </h2>
                    <p className="text-muted-foreground max-w-md mx-auto">
                        {String(t("AmpliTemplateDefault.comingSoon.description"))}
                    </p>
                </div>
            );
        default:
            console.warn(`Unknown tab activate type: ${activeTab}`);
            return null;
    }
}