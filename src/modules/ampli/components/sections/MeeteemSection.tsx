import { useFetchAnswerQuery } from "@/modules/ampli/hooks/useFetchAnswerQuery";
import { MeeteemSectionProps } from "@/types/site-schema";
import { TextAlignJustifyIcon } from "@radix-ui/react-icons";
import { ChevronDown, Columns2Icon, FunnelIcon, Heart, MapIcon, MapPinIcon, MessageCircle, XIcon } from "lucide-react";
import { useState } from "react";

export default function MeeteemSection({ id, props }: { id?: string, props: MeeteemSectionProps }) {
    const [viewMode, setViewMode] = useState<'answers' | 'map' | 'split'>('answers');

    const [activeFilters, setActiveFilters] = useState<string[]>([]);
    const [userFilter, setUserFilter] = useState<string | null>(null);
    const [filtersCollapsed, setFiltersCollapsed] = useState<boolean>(false);
    const {
        coform,
        path: dataPath
    } = props;

    const {
        lastItemRef,
        transformedResults: _rawResults,
        isLoading
    } = useFetchAnswerQuery({
        queryKeyPrefix: `Meeteem-${coform}`,
        coformId: coform,
        view: viewMode,
        baseParams: {
            indexStepList: 6,
            indexStepMap: 0,
            defaultFilters: {
                form: coform,
                finderPath: dataPath.finder || "",
                ...(
                    dataPath.name != "" ? {
                        [`answers.${dataPath.name}`]: {
                            '$exists': true
                        }
                    } : {}
                )
            },
            defaultFields: [
                ...(Object.values(dataPath).map((value) => `answers.${value}`)),
                "user",
                "vote",
                "voteCount"
            ],
            defaultSortBy: {
                created: -1
            }
        },
        extractionConfig: {
            dataPath,
            prefix: "answers",
            includeUserInfo: true
        }
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformedResults = _rawResults as any[];

    // Gestion des filtres par tags
    const toggleFilter = (tag: string) => {
        setActiveFilters(prev =>
            prev.includes(tag)
                ? prev.filter(t => t !== tag)
                : [...prev, tag]
        );
    };


    // Configuration des tags disponibles
    const availableTags = isLoading ? [] : transformedResults.reduce<string[]>((acc, { data }) => {
        data.tags?.forEach((tag: string) => {
            if (!acc.includes(tag)) {
                acc.push(tag);
            }
        });
        return acc;
    }, []);

    // Filtrer les cartes
    const filteredCards = transformedResults.filter(({ data, user }) => {
        if (activeFilters.length === 0 && !userFilter) return true;

        const matchesTag = activeFilters.length === 0 ||
            data.tags?.some((tag: string) => activeFilters.includes(tag));

        const matchesUser = !userFilter ||
            user.name === userFilter;

        return matchesTag && matchesUser;
    });

    return (
        <div className="w-full max-w-[1200px] mx-auto px-5 py-8" id={id}>
            {/* Header avec switch de vues */}
            <div className={`flex items-center ${userFilter ? "justify-between" : "justify-end"} gap-3 mb-4 flex-wrap md:flex-nowrap`}>
                {userFilter && (
                    <div className="flex items-center gap-2 bg-primary border border-primary/40 rounded-full px-3 py-1 transition-all">
                        <div className="w-6 h-6 rounded-full bg-white text-primary flex items-center justify-center text-xs font-semibold">
                            {userFilter.charAt(0)}
                        </div>
                        <span className="text-xs font-semibold text-white max-w-[100px] truncate">
                            {userFilter}
                        </span>
                        <button
                            onClick={() => setUserFilter(null)}
                            className="w-5 h-5 flex items-center justify-center text-white hover:bg-primary/40 hover:text-white rounded-full"
                        >
                            <XIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {/* Switch de vues */}
                <div className="flex items-center gap-3 p-1 rounded-lg border border-foreground/50">
                    <button
                        onClick={() => setViewMode('answers')}
                        className={`px-4 py-2 rounded-md border-none text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'answers'
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
                    <button
                        onClick={() => setViewMode('split')}
                        className={`px-4 py-2 rounded-md border-none text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'split'
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-foreground hover:text-primary'
                            }`}
                    >
                        <Columns2Icon className="w-4 h-4" />
                        <span>Split</span>
                    </button>
                </div>
            </div>

            {/* Conteneur des filtres */}
            <div className="flex flex-col flex-1 mb-6">
                <div className={`bg-transparent border border-gray-200 rounded-xl shadow-sm overflow-hidden transition-all`}>
                    {/* Titre des filtres avec accordéon */}
                    <div
                        onClick={() => setFiltersCollapsed(!filtersCollapsed)}
                        className="px-5 py-4 m-0 cursor-pointer flex items-center justify-between transition-all hover:bg-primary/10 select-none"
                    >
                        <div className="flex items-center gap-3 flex-1">
                            <FunnelIcon className="w-5 h-5 text-foreground" />
                            <span className="text-base font-semibold text-foreground">Filtres</span>
                            {activeFilters.length > 0 && (
                                <div className="bg-primary text-white rounded-full min-w-6 h-6 flex items-center justify-center text-xs font-semibold">
                                    {activeFilters.length}
                                </div>
                            )}
                        </div>
                        <ChevronDown className={`w-5 h-5 text-foreground transition-transform ${filtersCollapsed ? '' : 'rotate-180'}`} />
                    </div>

                    {/* Contenu des filtres */}
                    {!filtersCollapsed && (
                        <div className="p-5 transition-all">
                            <div className="flex flex-wrap gap-3">
                                {availableTags.map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => toggleFilter(tag)}
                                        className={`px-4 py-2 rounded-full text-sm font-medium cursor-pointer transition-all flex items-center gap-2 ${activeFilters.includes(tag)
                                            ? 'bg-primary border-primary text-white -translate-y-0.5 shadow-lg shadow-primary/30'
                                            : 'border border-gray-200 text-foreground hover:bg-primary hover:border-primary hover:text-white hover:-translate-y-0.5 hover:shadow-md'
                                            }`}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Vue Annuaire (liste) */}
            {viewMode === 'answers' && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(32%,1fr))] gap-3 w-full bg-tertiaire">
                    {filteredCards?.map(({ answer, data, user }, index) => (
                        <div
                            key={answer.serverData.id}
                            className="rounded-xl border border-foreground/40 shadow-md overflow-hidden hover:shadow-lg flex flex-col items-start p-4 border-l-4 border-l-primary/75 opacity-0 animate-[cardSlideIn_0.6s_cubic-bezier(0.4,0,0.2,1)_forwards]"
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            {/* Header */}
                            <div className="flex-1 pr-4 border-b border-gray-300 mb-4 w-full">
                                <div className="flex gap-2 mb-2 flex-wrap">
                                    {data.tags?.map((tag: string) => (
                                        <span
                                            key={tag}
                                            onClick={() => toggleFilter(tag)}
                                            className={`px-3 py-1 rounded-full text-xs font-medium border cursor-pointer bg-gray-50 text-gray-600 border-gray-300${activeFilters.includes(tag) ? " bg-primary text-white border-primary" : ""}`}
                                        >
                                            {availableTags.find(t => t === tag) || tag}
                                        </span>
                                    ))}
                                </div>
                                <h3 className="text-base font-semibold text-foreground m-0 mb-1 leading-snug cursor-pointer hover:text-primary transition-colors">
                                    {data.name}
                                </h3>
                            </div>

                            {/* Contenu */}
                            <div className="flex-[2_2_0%] pr-4">
                                <p className="text-foreground text-sm leading-relaxed m-0 overflow-hidden line-clamp-2">
                                    {data.description}
                                </p>
                            </div>

                            {/* Footer */}
                            <div className="shrink-0 flex justify-between gap-4 w-full">
                                {/* Auteur */}
                                <div
                                    onClick={() => setUserFilter(user?.name || "")}
                                    className="flex items-center gap-2 cursor-pointer transition-all rounded-lg p-1 hover:bg-primary/10"
                                >
                                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-semibold text-sm">
                                        {user?.initial}
                                    </div>
                                    <div className="flex flex-col gap-0.5 flex-1">
                                        <div className="font-semibold text-foreground text-xs">{user?.name}</div>
                                        <div className="text-[11px] text-foreground">{answer.serverData.created?.toLocaleDateString() ?? "N/A"}</div>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1 text-xs rounded-xl px-2 py-1 border border-pink-600 text-pink-600 texthover:-translate-y-0.5 hover:shadow-sm transition-all">
                                        <Heart className="w-3.5 h-3.5" />
                                        <span>{answer.serverData.vote ? Object.keys(answer.serverData.vote).length : 0}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs rounded-xl px-2 py-1 border text-primary border-primary hover:-translate-y-0.5 hover:shadow-sm transition-all">
                                        <MessageCircle className="w-3.5 h-3.5 text-primary" />
                                        <span>{answer.serverData.comments ? Object.keys(answer.serverData.comments).length : 0}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Vue Carte (Map) */}
            {viewMode === 'map' && (
                <div className="w-full h-[600px] rounded-xl border border-gray-200 overflow-hidden shadow-md mb-10">
                    <div className="w-full h-full bg-linear-to-br from-emerald-50 to-blue-50 flex items-center justify-center">
                        <div className="text-center">
                            <i className="fas fa-map-marked-alt text-6xl text-emerald-400 mb-4"></i>
                            <p className="text-gray-600 text-lg">Carte interactive</p>
                            <p className="text-gray-500 text-sm mt-2">(nécessite Leaflet.js)</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Vue Split */}
            {viewMode === 'split' && (
                <div className="flex gap-5 h-[600px]">
                    {/* Colonne gauche - Cartes */}
                    <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                        {filteredCards?.map(({ answer, data, user }) => (
                            <div
                                key={answer.serverData.id}
                                className="rounded-xl border border-foreground/40 shadow-md overflow-hidden hover:shadow-lg flex items-center p-4 border-l-4 border-l-primary/75"
                            >
                                <div className="flex-1">
                                    <div className="flex gap-2 mb-2 flex-wrap">
                                        {data.tags?.map((tag: string) => (
                                            <span
                                                key={tag}
                                                onClick={() => toggleFilter(tag)}
                                                className={`px-2 py-1 rounded-full text-xs font-medium border cursor-pointer bg-gray-50 text-gray-600 border-gray-300${activeFilters.includes(tag) ? " bg-primary text-white border-primary" : ""}`}>
                                                {availableTags.find(t => t === tag) || tag}
                                            </span>
                                        ))}
                                    </div>
                                    <h4 className="text-sm font-semibold text-foreground m-0 mb-1 cursor-pointer hover:text-primary">{data.name}</h4>
                                    <p className="text-xs text-foreground m-0 line-clamp-2">{data.description}</p>

                                    <div className="flex items-center gap-3 mt-3 w-full justify-between">
                                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setUserFilter(user?.name || "")}>
                                            <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-semibold">
                                                {user?.initial}
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-semibold text-sm">{user.name}</span>
                                                <span className="text-[11px]">{answer.serverData.created?.toLocaleDateString() ?? "N/A"}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1 text-[12px] rounded-xl px-2 py-1 border text-pink-500 border-pink-500 hover:-translate-y-0.5 hover:shadow-sm transition-all">
                                                <Heart className="w-3.5 h-3.5" />
                                                <span>{answer.serverData.vote ? Object.keys(answer.serverData.vote).length : 0}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-[12px] rounded-xl px-2 py-1 border text-primary border-primary hover:-translate-y-0.5 hover:shadow-sm transition-all">
                                                <MessageCircle className="w-3.5 h-3.5 text-primary" />
                                                <span>{answer.serverData.comments ? Object.keys(answer.serverData.comments).length : 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Colonne droite - Carte */}
                    <div className="flex-1 rounded-xl border border-gray-200 overflow-hidden shadow-md bg-linear-to-br from-emerald-50 to-blue-50 flex items-center justify-center">
                        <div className="text-center">
                            <MapIcon className="w-16 h-16 text-emerald-400 mb-4" />
                            <p className="text-gray-600">Carte interactive</p>
                            <p className="text-gray-500 text-xs mt-1">(Leaflet.js)</p>
                        </div>
                    </div>
                </div>
            )}

            {viewMode == "answers" && <div ref={lastItemRef} className="h-12" />}

            {/* Styles pour les animations personnalisées */}
            <style>
                {`
                @keyframes cardSlideIn {
                    0% {
                        opacity: 0;
                        transform: translateY(40px) scale(0.85);
                    }
                    60% {
                        opacity: 0.8;
                        transform: translateY(-8px) scale(1.02);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                
                .line-clamp-2 {
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
                
                .line-clamp-3 {
                    display: -webkit-box;
                    -webkit-line-clamp: 3;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
            `}
            </style>
        </div>
    );
}