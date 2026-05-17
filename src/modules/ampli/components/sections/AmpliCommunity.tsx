import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useState } from "react";
import { TextAlignJustifyIcon } from "@radix-ui/react-icons";
import { MapPinIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { User } from "@communecter/cocolight-api-client";
import { AmpliConfig } from "../../schema";
import { getSummaryData } from "../../helpers/summary";
import type { UserWithContributions } from "../../helpers/summary";
import AmpliUserCard from "../AmpliUserCard";
import { MeeteemMapPlaceholder } from "./parts/MeeteemMapPlaceholder";

interface AmpliCommunityProps {
    props: AmpliConfig["props"]["community"];
    data: Parameters<typeof getSummaryData>[0];
}

export default function AmpliCommunity({ props, data }: AmpliCommunityProps) {
    useLoadNamespace("modules/ampli");
    const t = useT("modules/ampli");
    const [viewMode, setViewMode] = useState<"list" | "map">("list");

    const { headline, subhead } = props || {};

    const summary = getSummaryData(data)?.users ?? [];

    return (
        <section className="container mx-auto py-12 md:py-16" id="ampli-community-section">
            <div className="text-center my-4 sm:my-6 md:my-10">
                <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                    {headline ? t(headline) : t("AmpliCommunity.headline")}
                </h2>
                <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                    {subhead ? t(subhead) : t("AmpliCommunity.subhead")}
                </p>
                {/* Switch de vues */}
                <div className="mt-6 mx-auto flex items-center justify-center w-fit gap-1 p-1 rounded-lg border border-border">
                    <Button
                        variant={viewMode === "list" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("list")}
                        className={cn("gap-2", viewMode === "list" && "shadow-sm")}
                    >
                        <TextAlignJustifyIcon className="w-4 h-4" />
                        <span>{String(t("MeeteemSection.viewToggle.answers"))}</span>
                    </Button>
                    <Button
                        variant={viewMode === "map" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("map")}
                        className={cn("gap-2", viewMode === "map" && "shadow-sm")}
                    >
                        <MapPinIcon className="w-4 h-4" />
                        <span>{String(t("MeeteemSection.viewToggle.map"))}</span>
                    </Button>
                </div>
            </div>
            {viewMode === "list" && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5 py-5 px-2 md:px-0">
                    {summary.map((userSummary: UserWithContributions, index: number) => (
                        <AmpliUserCard
                            key={index}
                            user={
                                userSummary.user instanceof Object &&
                                !(typeof userSummary.user === "string") &&
                                "serverData" in (userSummary.user as object)
                                    ? (userSummary.user as User)
                                    : undefined
                            }
                            contributionCount={userSummary.contributionCount}
                        />
                    ))}
                </div>
            )}
            {viewMode === "map" && <MeeteemMapPlaceholder variant="large" />}
        </section>
    );
}
