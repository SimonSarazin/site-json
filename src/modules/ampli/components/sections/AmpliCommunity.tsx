import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { Suspense, useMemo, useState } from "react";
import { lazy } from "vite-preload";
import { TextAlignJustifyIcon } from "@radix-ui/react-icons";
import { MapPinIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { User } from "@communecter/cocolight-api-client";
import { getSummaryData } from "../../helpers/summary";
import type { UserWithContributions } from "../../helpers/summary";
import AmpliUserCard from "../AmpliUserCard";

// Ce module est importé en EAGER par `AmpliSectionRenderer` (contrairement à
// ses voisins) : la carte doit rester derrière un `lazy()`, sinon tout le stack
// MapLibre + supercluster + i18n search entre dans le bundle initial du tab.
const AmpliContributorsMap = lazy(() => import("./parts/AmpliContributorsMap"));

interface AmpliCommunityProps {
    data: Parameters<typeof getSummaryData>[0];
    /** Query du renderer en cours — la carte doit distinguer « ça charge » de
     *  « personne n'est localisé ». */
    isLoading?: boolean;
    /** Query pas encore lancée (`entity` non initialisée) : `isLoading` est
     *  alors FAUX alors que rien n'est chargé. */
    isPending?: boolean;
    /** La requête a échoué — `isLoading` et `isPending` sont alors tous deux
     *  faux, d'où ce troisième signal. */
    isError?: boolean;
}

export default function AmpliCommunity({ data, isLoading = false, isPending = false, isError = false }: AmpliCommunityProps) {
    useLoadNamespace("modules/ampli");
    const t = useT("modules/ampli");
    const [viewMode, setViewMode] = useState<"list" | "map">("list");

    // Mémoïsé : l'agrégation parcourt tout le périmètre, et `data` est un
    // tableau recréé à chaque rendu par le renderer — sans ce mémo, la carte
    // recevrait un `results` d'identité neuve à chaque changement d'état.
    const summary = useMemo(() => getSummaryData(data)?.users ?? [], [data]);

    return (
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16" id="ampli-community-section">
            <div className="text-center my-4 sm:my-6 md:my-10">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground text-balance mb-4 sm:mb-6">
                    {t("AmpliCommunity.headline")}
                </h2>
                <p className="text-base sm:text-lg md:text-xl text-muted-foreground text-pretty max-w-3xl mx-auto leading-relaxed">
                    {t("AmpliCommunity.subhead")}
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
                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-5 py-5">
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
            {viewMode === "map" && (
                <Suspense fallback={<div className="h-80 sm:h-105 md:h-150 rounded-xl border border-border bg-muted/30" />}>
                    <AmpliContributorsMap users={summary} isLoading={isLoading} isPending={isPending} isError={isError} />
                </Suspense>
            )}
        </section>
    );
}
