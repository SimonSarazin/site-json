import { useMemo } from "react";
import { lazy } from "vite-preload";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import type { ConfiguredAmpli } from "./types";
import { useFetchAnswerQuery } from "./hooks/useFetchAnswerQuery";
import { AmpliDataResponse } from "./helpers/summary";
import { ampliAnswerFields, ampliAnswerFilters } from "./lib/answersQuery";
import AmpliCommunity from "./components/sections/AmpliCommunity";

interface AmpliSectionRendererProps {
    activeTab: string;
    ampli: ConfiguredAmpli;
}

const AmpliHeader = lazy(() => import("./components/sections/AmpliHeader"));
const AmpliIntro = lazy(() => import("./components/sections/AmpliIntro"));
const AmpliFeatures = lazy(() => import("./components/sections/AmpliFeatures"));
const AmpliMessages = lazy(() => import("./components/sections/AmpliMessages"));
const AmpliDashboard = lazy(() => import("./components/sections/AmpliDashboard"));


export function AmpliSectionRenderer({ activeTab, ampli }: AmpliSectionRendererProps) {
    useLoadNamespace("modules/ampli");
    const t = useT("modules/ampli");
    const { coform, path } = ampli;

    // MÉMOÏSÉS — ces deux objets entrent dans la queryKey ET dans les deps du
    // `useMemo` qui transforme les résultats. En littéral inline, ils changeaient
    // d'identité à chaque rendu : `transformedResults` était un tableau NEUF à
    // chaque fois, ce qui invalidait en cascade toutes les mémoïsations en aval
    // (agrégation des contributeurs, modèle carto, index de clustering, mémo de
    // chaque marqueur). Même précaution que `MeeteemSection`.
    // Filtres et champs partagés avec les compteurs de `/ampli` (cf. `answersQuery`).
    const baseParams = useMemo(() => ({
        indexStepList: 6,
        indexStepMap: 0,
        defaultFilters: ampliAnswerFilters(coform, path),
        defaultFields: ampliAnswerFields(path),
        defaultSortBy: {
            created: -1 as const
        }
    }), [coform, path]);

    const extractionConfig = useMemo(() => ({
        dataPath: path,
        prefix: "answers",
        includeUserInfo: true
    }), [path]);

    const {
        transformedResults,
        isLoading,
        isPending,
        error
    } = useFetchAnswerQuery({
        coformId: coform,
        view: "map",
        baseParams,
        extractionConfig
    });

    switch (activeTab) {
        case "home":
            return (
                <>
                    <AmpliHeader name={ampli.name} />
                    <AmpliIntro />
                    <AmpliFeatures coform={coform} isLoading={isLoading} data={transformedResults as AmpliDataResponse[]} />
                    <AmpliMessages coform={coform} path={path} />
                </>
            );
        case "community":
            return (
                <AmpliCommunity
                    data={transformedResults as AmpliDataResponse[]}
                    isLoading={isLoading}
                    isPending={isPending}
                    isError={Boolean(error)}
                />
            );
        case "stats":
            return (
                <AmpliDashboard
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
