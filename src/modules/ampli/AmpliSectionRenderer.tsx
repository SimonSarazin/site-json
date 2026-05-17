import { lazy } from "react";
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


export function AmpliSectionRenderer({ activeTab, config }: AmpliSectionRendererProps) {
    useLoadNamespace("modules/ampli");
    const t = useT("modules/ampli");
    const {
        transformedResults,
        isLoading
    } = useFetchAnswerQuery({
        queryKeyPrefix: `Meeteem-${config.coform}`,
        coformId: config.coform,
        view: "map",
        baseParams: {
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
                created: -1
            }
        },
        extractionConfig: {
            dataPath: config.path,
            prefix: "answers",
            includeUserInfo: true
        }
    });

    switch (activeTab) {
        case "home":
            return (
                <>
                    <AmpliHeader props={config.hero} />
                    <AmpliIntro props={config.intro} />
                    <AmpliFeatures props={config.features} isLoading={isLoading} data={transformedResults as AmpliDataResponse[]} />
                    <AmpliMessages props={config.message} coform={config.coform} path={config.path} />
                </>
            );
        case "community":
            return (
                <AmpliCommunity props={config.community} data={transformedResults as AmpliDataResponse[]} />
            );
        case "stats":
        case "news":
            // Routes déclarées dans routes.tsx mais sections pas encore implémentées.
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