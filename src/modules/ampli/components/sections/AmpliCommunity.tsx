import { useT } from "@/hooks/useT";
import { AmpliConfig } from "../../schema";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useState } from "react";
import { TextAlignJustifyIcon } from "@radix-ui/react-icons";
import { MapPinIcon } from "lucide-react";
import { getSummaryData } from "../../helpers/summary";
import AmpliUserCard from "../AmpliUserCard";
import type { UserWithContributions } from "../../helpers/summary";
import { User } from "@communecter/cocolight-api-client";

interface AmpliCommunityProps {
    props: AmpliConfig["props"]["community"];
    data: Parameters<typeof getSummaryData>[0];
}

export default function AmpliCommunity({ props, data }: AmpliCommunityProps) {
    useLoadNamespace("modules/ampli");
    const t = useT("modules/ampli");
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

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
                <div className="mt-6 mx-auto flex items-center justify-center w-fit gap-3 p-1 rounded-lg border border-foreground/50">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`px-4 py-2 rounded-md border-none text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'list'
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-foreground hover:text-primary'
                            }`}
                    >
                        <TextAlignJustifyIcon className="w-4 h-4" />
                        <span>Annuaire</span>
                    </button>
                    <button
                        onClick={() => setViewMode('map')}
                        className={`px-4 py-2 rounded-md border-none text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'map'
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-foreground hover:text-primary'
                            }`}
                    >
                        <MapPinIcon className="w-4 h-4" />
                        <span>Carte</span>
                    </button>
                </div>
            </div>
            {
                viewMode === 'list' && (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5 py-5 px-2 md:px-0">
                        {summary.map((userSummary: UserWithContributions, index: number) => (
                            <AmpliUserCard key={index} user={userSummary.user instanceof Object && !(typeof userSummary.user === 'string') && 'serverData' in (userSummary.user as object) ? userSummary.user as User : undefined} contributionCount={userSummary.contributionCount} />
                        ))}
                    </div>
                )
            }
            {
                viewMode === 'map' && (
                    <div className="w-full h-150 rounded-xl border border-gray-200 overflow-hidden shadow-md mb-10">
                        <div className="w-full h-full bg-linear-to-br from-emerald-50 to-blue-50 flex items-center justify-center">
                            <div className="text-center">
                                <i className="fas fa-map-marked-alt text-6xl text-emerald-400 mb-4"></i>
                                <p className="text-gray-600 text-lg">Carte interactive</p>
                                <p className="text-gray-500 text-sm mt-2">(nécessite Leaflet.js)</p>
                            </div>
                        </div>
                    </div>
                )
            }
        </section>
    );
}