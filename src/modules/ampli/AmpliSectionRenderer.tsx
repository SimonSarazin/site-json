import { lazy } from "react";
import { AmpliConfig } from "./schema";
import { useFetchAnswerQuery } from "./hooks/useFetchAnswerQuery";
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
                    <AmpliHeader props={config.hero} form={config.coform} />
                    <AmpliIntro props={config.intro} />
                    <AmpliFeatures props={config.features} isLoading={isLoading} data={transformedResults} />
                    <AmpliMessages props={config.message} coform={config.coform} path={config.path} />
                </>
            );
        case "community": 
            return (
                <AmpliCommunity props={config.community}  isLoading={isLoading} data={transformedResults} />
            );
        default:
            console.warn(`Unknown tab activate type: ${activeTab}`);
            return null;
    }
}