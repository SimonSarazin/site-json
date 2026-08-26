/**
 * Header de recherche : titre + sous-titre, boutons d'action (modals/join/href),
 * input texte + `dropdownFilters`, badges `types`. Producteur du
 * `PageFiltersContext` (variante horizontale de `<FiltersSection>`).
 *
 * Type config canonique : `searchHeader`. Alias rétro-compat :
 * (ancien alias `title-with-filters-rezo-la-mer` supprimé — migré vers `searchHeader`).
 */
import "@/modules/search/i18n";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useDynamicFilterOptions } from "@/modules/search/hooks/useDynamicFilterOptions";
import { resolveFilterHydration } from "@/modules/search/lib/hydrateDropdownFilter";
import { useSearchParams } from "react-router";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useDebounce } from "@/hooks/useDebounce";
import { type SearchHeaderSectionProps } from "@/types/site-schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MultiCombobox } from "@/components/ui/multi-combobox";
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { ChevronDown, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { usePageFiltersOptional } from "@/modules/search/contexts/pageFilters";
import { useCocolight } from "@/hooks/useCocolight";
import { ActionButtonGroup } from "@/modules/profil/components/ActionButtonGroup";
interface SearchHeaderSectionComponentProps {
    id?: string;
    props: SearchHeaderSectionProps;
}

type DropdownFilterConfig = NonNullable<SearchHeaderSectionProps["dropdownFilters"]>[number];

/**
 * Sites historiques dont le sous-titre n'applique PAS `text-foreground` (couleur
 * héritée, pour la lisibilité sur leur dégradé). Comme leur config ET leur CSS
 * sont mutualisées entre plusieurs slugs, ce choix est propre au déploiement →
 * discriminé au runtime via `entity.slug`. Fallback rétro-compat : tout nouveau
 * site doit plutôt utiliser le prop `subheadClassName`.
 */
const LEGACY_INHERIT_SUBHEAD_SLUGS = new Set(["nosCommunes", "etangsale1"]);

export function SearchHeaderSection({ id, props }: SearchHeaderSectionComponentProps) {
    useLoadNamespace("modules/search");
    // `t` gère les deux cas : clé string → namespace i18n ; objet LocalizedString
    // → résolution par locale (cf. useT). Un seul translator suffit.
    const t = useT("modules/search");

    const pageFilters = usePageFiltersOptional();
    const setSearchQuery = useMemo(() => pageFilters?.setSearchQuery ?? (() => {}), [pageFilters?.setSearchQuery]);
    const setSelectedFilters = pageFilters?.setSelectedFilters ?? (() => {});
    const setSearchByFields = pageFilters?.setSearchByFields ?? (() => {});
    const selectedFilters = useMemo(
        () => pageFilters?.selectedFilters ?? {},
        [pageFilters?.selectedFilters],
    );
    const searchByFields = useMemo(
        () => pageFilters?.searchByFields ?? {},
        [pageFilters?.searchByFields],
    );
    // Options RÉSOLUES : un filtre à `optionsFrom` reçoit les valeurs réelles de la donnée ; les autres
    // sont renvoyés tels quels, sans aucune requête. Toutes les lectures ci-dessous passent par cette
    // liste et non par `props.dropdownFilters`, sinon l'hydratation et les étiquettes travailleraient
    // sur des options périmées.
    // Le terme tapé dans un dropdown sert deux fois : filtrage local immédiat (dans le combobox), et —
    // pour une liste que le serveur a coupée — recherche SERVEUR au-delà de la coupe.
    const [rechercheFiltre, setRechercheFiltre] = useState<Record<string, string>>({});
    const rechercheFiltreDebounce = useDebounce(rechercheFiltre, 300);
    const dropdownFilters = useDynamicFilterOptions(props.dropdownFilters, rechercheFiltreDebounce);
    // `dropdownFilters` porte aussi les filtres `hidden` (ils doivent quand même s'hydrater depuis
    // l'URL et filtrer le contenu) — tout ce qui touche au RENDU (contrôles, compteur, reset, tags)
    // passe par ce sous-ensemble visible ; l'hydratation, elle, reste sur la liste complète.
    const visibleDropdownFilters = (dropdownFilters ?? []).filter((f) => !f.hidden);
    const hasDropdownFilters = visibleDropdownFilters.length > 0;

    const activeType = selectedFilters['type']?.[0] ?? "all";

    const { entity } = useCocolight();
    const slugEntity = entity?.slug;

    // SYNCHRONISATION URL (`?<filter.id>=<slug,slug>` et `?q=…`, format maison
    // sans virgule dans une valeur) — permaliens partageables + liens depuis
    // l'accueil qui pré-activent les filtres. Même pattern que l'Observatoire
    // (`useObservatoryFilters`) : l'URL est un miroir écrit en `replace`,
    // l'état du contexte reste la source.
    const [searchParams, setSearchParams] = useSearchParams();
    const writeParams = useCallback(
        (mutate: (params: URLSearchParams) => void) => {
            setSearchParams(
                (prev) => {
                    const params = new URLSearchParams(prev);
                    mutate(params);
                    return params;
                },
                { replace: true, preventScrollReset: true },
            );
        },
        [setSearchParams],
    );

    // Input texte : état local réactif + debounce avant publication dans le
    // context (sinon chaque frappe relance la recherche backend). Même hook et
    // même délai (400 ms) que la sidebar `<FiltersSection>`. Valeur initiale
    // restaurée depuis l'URL (`?q=`) au montage.
    const [localSearchQuery, setLocalSearchQuery] = useState(
        searchParams.get("q") ?? pageFilters?.searchQuery ?? "",
    );
    const debouncedSearchQuery = useDebounce(localSearchQuery, 400);
    // Sheet "Filtres" mobile (les dropdowns sont regroupés derrière un bouton)
    const [filtersOpen, setFiltersOpen] = useState(false);

    useEffect(() => {
        setSearchQuery(debouncedSearchQuery);
        writeParams((params) => {
            if (debouncedSearchQuery.trim()) params.set("q", debouncedSearchQuery.trim());
            else params.delete("q");
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearchQuery]);

    const handleTypeChange = (typeId: string) => {
        if (typeId === "all") {
            setSelectedFilters(prev => {
                const newFilters = { ...prev };
                delete newFilters['type'];
                return newFilters;
            });
        } else {
            setSelectedFilters(prev => ({
                ...prev,
                type: [typeId]
            }));
        }
    };

    const getDropdownSelectedValues = (filter: DropdownFilterConfig): string[] => {
        if (filter.field) {
            return filter.options
                .filter((option) => !!searchByFields[`${filter.id}:${option.id}`])
                .map((option) => option.id);
        }

        return selectedFilters[filter.id] ?? [];
    };

    // Reflète la sélection (ids/slugs d'option) dans l'URL — appelé pour toute
    // mutation (toggle, reset, suppression de tag) → l'URL reste cohérente.
    const writeFilterParam = (filter: DropdownFilterConfig, nextSelectedIds: string[]) => {
        writeParams((params) => {
            if (nextSelectedIds.length) params.set(filter.id, nextSelectedIds.join(","));
            else params.delete(filter.id);
        });
    };

    const setDropdownSelection = (filter: DropdownFilterConfig, nextSelectedIds: string[]) => {
        writeFilterParam(filter, nextSelectedIds);
        if (filter.field) {
            const fieldName = filter.field;
            setSearchByFields((prev) => {
                const prefix = `${filter.id}:`;
                const cleaned = Object.fromEntries(
                    Object.entries(prev).filter(([key]) => !key.startsWith(prefix))
                );

                if (nextSelectedIds.length === 0) {
                    return cleaned;
                }

                const next = { ...cleaned };
                    nextSelectedIds.forEach((selectedId) => {
                        const option = filter.options.find((item) => item.id === selectedId);
                        if (!option) return;

                        const optionField = option.field ?? fieldName;
                        next[`${filter.id}:${selectedId}`] = {
                            field: optionField,
                            value: [option.value ?? option.id],
                        };
                    });

                return next;
            });
            return;
        }

        setSelectedFilters((prev) => {
            const next = { ...prev };

            if (nextSelectedIds.length === 0) {
                delete next[filter.id];
                return next;
            }

            next[filter.id] = nextSelectedIds;
            return next;
        });
    };

    const toggleDropdownOption = (filter: DropdownFilterConfig, optionId: string) => {
        const currentSelection = getDropdownSelectedValues(filter);
        const isSelected = currentSelection.includes(optionId);
        const isMultiple = filter.multiple === true;

        const nextSelection = isSelected
            ? currentSelection.filter((item) => item !== optionId)
            : isMultiple
                ? [...currentSelection, optionId]
                : [optionId];

        setDropdownSelection(filter, nextSelection);
    };

    const getDropdownTriggerLabel = (filter: DropdownFilterConfig): string => {
        const selectedIds = getDropdownSelectedValues(filter);

        if (selectedIds.length === 0) {
            return t(filter.label);
        }

        if (selectedIds.length === 1) {
            const selectedOption = filter.options.find((option) => option.id === selectedIds[0]);
            if (selectedOption) {
                return t(selectedOption.label);
            }
        }

        return `${t(filter.label)} (${selectedIds.length})`;
    };

    // Compteur = nombre total de VALEURS sélectionnées (= nombre de chips), pas le
    // nombre de catégories de filtre → cohérent avec les pastilles affichées. Filtres `hidden`
    // exclus : le badge/bouton reset ne doit réagir qu'à ce que l'utilisateur peut lui-même toucher.
    const activeFilterCount = visibleDropdownFilters.reduce(
        (sum, filter) => sum + getDropdownSelectedValues(filter).length,
        0
    );

    const resetAllDropdownFilters = () => {
        // Filtres `hidden` exclus : "Réinitialiser" ne doit pas effacer le filtre qui définit
        // l'identité de la page (ex. `?theme=` posé par le menu, pas par l'utilisateur ici).
        const filters = visibleDropdownFilters;
        // Une seule mutation : plusieurs setSearchParams dans le même cycle voient le même `prev` (React Router).
        writeParams((params) => {
            filters.forEach((filter) => params.delete(filter.id));
        });
        filters.forEach((filter) => {
            if (filter.field) {
                setSearchByFields((prev) => {
                    const prefix = `${filter.id}:`;
                    return Object.fromEntries(
                        Object.entries(prev).filter(([key]) => !key.startsWith(prefix))
                    );
                });
            } else {
                setSelectedFilters((prev) => {
                    const next = { ...prev };
                    delete next[filter.id];
                    return next;
                });
            }
        });
    };

    // Hydratation : restaure les filtres depuis l'URL → contexte. Décision PURE et testée
    // (`resolveFilterHydration`, `hydrateDropdownFilter.ts`) : ce composant ne fait que la lire et
    // la dispatcher. Garde PAR FILTRE ET PAR VALEUR (pas un simple flag « déjà fait ») : ré-appliquée
    // à chaque fois que la VALEUR vue dans l'URL change pour ce filtre — pas seulement au montage.
    // Nécessaire pour `dynamicList` (menu de header) : plusieurs clics peuvent cibler la MÊME page
    // avec une valeur de filtre différente à chaque fois (ex. `/theme?theme=A` puis
    // `/theme?theme=B`) — React Router ne remonte PAS le composant pour un changement de query seul
    // (même route), donc un simple ref « hydraté une fois pour toutes » (ancien code) ignorait
    // silencieusement le 2ᵉ clic : l'URL changeait, le contenu ne se réappliquait jamais.
    const hydratedRawRef = useRef<Record<string, string>>({});
    useEffect(() => {
        (dropdownFilters ?? []).forEach((filter) => {
            const raw = searchParams.get(filter.id) ?? "";
            const decision = resolveFilterHydration({
                raw,
                lastAppliedRaw: hydratedRawRef.current[filter.id],
                optionsReady: filter.optionsReady,
                hasCurrentSelection: getDropdownSelectedValues(filter).length > 0,
                optionIds: filter.options.map((o) => o.id),
            });
            if (decision.action === "wait") return;
            hydratedRawRef.current[filter.id] = raw;
            if (decision.action === "clear") setDropdownSelection(filter, []);
            else if (decision.action === "apply") setDropdownSelection(filter, decision.ids);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dropdownFilters, searchParams]);

    // Tags des filtres actifs (supprimables individuellement). Couvre les DEUX
    // formes de dropdown : à `field` (sélection dans `searchByFields`, clés
    // `filterId:optionId`) ET sans `field` (sélection dans `selectedFilters[filterId]`)
    // → robuste pour toute config, ce composant étant partagé.
    const activeFilterTags = useMemo(() => {
        const result: Array<{ filterId: string; optionId: string; label: string }> = [];
        // Filtres à `field` → searchByFields.
        for (const key of Object.keys(searchByFields)) {
            const colonIdx = key.indexOf(":");
            if (colonIdx < 0) continue;
            const filterId = key.slice(0, colonIdx);
            const optionId = key.slice(colonIdx + 1);
            const filter = dropdownFilters?.find((f) => f.id === filterId);
            // `hidden` exclu : pas de tag pour un filtre sans contrôle visible (ex. `?theme=` de la
            // page /theme), cohérent avec l'absence du dropdown lui-même.
            if (!filter || filter.hidden) continue;
            const option = filter.options.find((o) => o.id === optionId);
            // Valeur ACTIVE mais absente des options : on l'affiche avec son libellé brut plutôt que de
            // la taire. Sur une source dynamique elle peut être parfaitement légitime et simplement rare ;
            // l'escamoter laissait un filtre actif sans étiquette pour le retirer. Un filtre statique n'est
            // pas concerné — ses options sont toutes connues.
            result.push({ filterId, optionId, label: option ? t(option.label) : optionId });
        }
        // Filtres sans `field` → selectedFilters[filterId] (ids d'option).
        for (const filter of dropdownFilters ?? []) {
            if (filter.field || filter.hidden) continue;
            for (const optionId of selectedFilters[filter.id] ?? []) {
                const option = filter.options.find((o) => o.id === optionId);
                result.push({ filterId: filter.id, optionId, label: option ? t(option.label) : optionId });
            }
        }
        return result;
    }, [searchByFields, selectedFilters, dropdownFilters, t]);

    // Rendu d'un dropdown de filtre, réutilisé en barre desktop (inline) ET dans
    // la Sheet mobile. `w-full` par défaut (Sheet) → `lg:w-auto` en barre desktop.
    const renderDropdownFilter = (filter: DropdownFilterConfig) => {
        const selectedValues = getDropdownSelectedValues(filter);
        return (
            // Combobox multi partagé (ui/multi-combobox) : items au look
            // SelectItem, coche à DROITE, reste ouvert pendant la sélection.
            <MultiCombobox
                key={filter.id}
                options={filter.options.map((option) => ({
                    id: option.id,
                    label: (
                        <>
                            {option.icon && (
                                <DynamicIcon name={option.icon as IconName} className="w-4 h-4" />
                            )}
                            {t(option.label)}
                        </>
                    ),
                    // Le libellé est un fragment (icône + texte) : la recherche a besoin du texte seul.
                    searchText: t(option.label),
                }))}
                selected={selectedValues}
                onToggle={(id) => toggleDropdownOption(filter, id)}
                allLabel={filter.allLabel ? t(filter.allLabel) : t("Tous")}
                onClear={() => setDropdownSelection(filter, [])}
                // Options DYNAMIQUES (`optionsFrom`) : la liste suit les données, sa taille n'est plus
                // bornée par la config → recherche et plafond de rendu au-delà des seuils du combobox.
                onSearchChange={(terme) => setRechercheFiltre((p) => ({ ...p, [filter.id]: terme }))}
                searchPlaceholder={t("Rechercher…")}
                noResultLabel={t("Aucun résultat")}
                moreLabel={(n) => t("+{{count}} autres — précisez la recherche", undefined, { count: n })}
                contentClassName="w-72"
            >
                <Button
                    variant="outline"
                    className="h-11 w-full justify-between rounded-xl border-border bg-muted/60! px-3 text-foreground shadow-sm hover:border-primary/50 hover:bg-muted! hover:text-foreground lg:w-auto lg:min-w-[150px] lg:max-w-full dark:bg-muted/50! dark:hover:bg-muted/70!"
                >
                    <span className="truncate">{getDropdownTriggerLabel(filter)}</span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
                </Button>
            </MultiCombobox>
        );
    };

    return (
        <section id={id} className="relative pt-10 px-4 bg-[image:var(--gradient-section)] overflow-hidden">
            {/* Bulles décoratives floutées — purement visuelles : `pointer-events-none`
                sinon la bulle bas-droite (absolute) peint AU-DESSUS de la barre de
                filtres statique et intercepte les clics du dernier dropdown. */}
            <div className="pointer-events-none absolute inset-0 opacity-10">
                <div className="absolute top-10 left-10 w-64 h-64 bg-primary rounded-full blur-3xl animate-float" />
                <div
                    className="absolute bottom-10 right-10 w-96 h-96 bg-chart-2 rounded-full blur-3xl animate-float"
                    style={{ animationDelay: "2s" }}
                />
            </div>

            {/* Padding hero : `py-12` par défaut ; `py-4` UNIQUEMENT si `props.compact` (opt-in explicite,
                ex. pages territoire/thème dont le titre vient d'une section `title` au-dessus). L'auto-détection
                « pas de headline → py-4 » cassait les pages dont le searchHeader nu EST le hero (ex.
                sport-sante-bien-etre /blog) → on rend le compactage EXPLICITE. */}
            <div
                className={`relative z-10 container mx-auto max-w-6xl px-4 text-center ${
                    props.compact ? "py-4" : "py-12"
                }`}
            >
                {props.headline && (
                    <h1 className={`text-4xl md:text-6xl font-bold mb-6 ${props.headlineClassName ?? "text-foreground"} animate-fade-in`}>
                        {t(props.headline)}
                    </h1>
                )}
                {props.subhead && (
                    <p className={`text-xl ${props.subheadClassName ?? (LEGACY_INHERIT_SUBHEAD_SLUGS.has(slugEntity ?? "") ? "" : "text-foreground")} max-w-2xl mx-auto animate-fade-in`}>
                        {t(props.subhead)}
                    </p>
                )}

                <ActionButtonGroup buttons={props.buttons} />
            </div>

            {(props.showSearch || hasDropdownFilters) && (
                <div className={`container mx-auto px-4 mb-8 ${hasDropdownFilters ? "max-w-6xl" : "max-w-2xl"}`}>
                    <div className={`gap-3 ${hasDropdownFilters ? (props.filtersClassName ?? "flex flex-col lg:flex-row lg:items-center") : ""}`}>
                        {props.showSearch && (
                            <div className={hasDropdownFilters ? "relative w-full" : "relative"}>
                                <DynamicIcon
                                    name="search"
                                    className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground"
                                />
                                <Input
                                    type="search"
                                    placeholder={props.searchPlaceholder ? t(props.searchPlaceholder) : t("Rechercher...")}
                                    value={localSearchQuery}
                                    onChange={(e) => setLocalSearchQuery(e.target.value)}
                                    className={hasDropdownFilters
                                        ? "h-11 rounded-xl border-border bg-muted/60! pl-12 text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 dark:bg-muted/50!"
                                        : "pl-12 h-12 bg-secondary/40 backdrop-blur-md border-primary/30 focus:border-primary text-foreground placeholder:text-muted-foreground"
                                    }
                                />
                            </div>
                        )}

                        {hasDropdownFilters && (
                            <>
                                {/* Desktop : filtres inline, regroupés dans la barre */}
                                <div className="hidden w-full flex-wrap items-center justify-center gap-3 lg:flex">
                                    {visibleDropdownFilters.map(renderDropdownFilter)}
                                    {activeFilterCount > 0 && (
                                        <>
                                            <Badge className="rounded-full px-2">{activeFilterCount}</Badge>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={resetAllDropdownFilters}
                                                className="h-9 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                                            >
                                                <RotateCcw className="h-3 w-3" /> {t("Réinitialiser")}
                                            </Button>
                                        </>
                                    )}
                                </div>

                                {/* Mobile : un seul bouton "Filtres" (compteur actif) → Sheet bas */}
                                <div className="w-full lg:hidden">
                                    <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                                        <SheetTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="h-11 w-full justify-between rounded-xl border-border bg-muted/60! px-3 text-foreground shadow-sm hover:bg-muted! dark:bg-muted/50!"
                                            >
                                                <span className="flex items-center gap-2">
                                                    <SlidersHorizontal className="h-4 w-4" />
                                                    {t("Filtres")}
                                                </span>
                                                {activeFilterCount > 0 && (
                                                    <Badge className="ml-2 rounded-full px-2">{activeFilterCount}</Badge>
                                                )}
                                            </Button>
                                        </SheetTrigger>
                                        <SheetContent side="bottom" className="max-h-[85vh] gap-0 rounded-t-2xl p-0">
                                            <SheetHeader className="border-b border-border">
                                                <SheetTitle className="flex items-center gap-2">
                                                    <SlidersHorizontal className="h-5 w-5 text-primary" />
                                                    {t("Filtres")}
                                                    {activeFilterCount > 0 && (
                                                        <Badge className="rounded-full px-2">{activeFilterCount}</Badge>
                                                    )}
                                                </SheetTitle>
                                            </SheetHeader>
                                            <div className="flex flex-col gap-3 overflow-y-auto p-4">
                                                {visibleDropdownFilters.map(renderDropdownFilter)}
                                            </div>
                                            <SheetFooter className="flex-row gap-2 border-t border-border">
                                                {activeFilterCount > 0 && (
                                                    <Button
                                                        variant="ghost"
                                                        className="flex-1"
                                                        onClick={resetAllDropdownFilters}
                                                    >
                                                        {t("Réinitialiser")}
                                                    </Button>
                                                )}
                                                <SheetClose asChild>
                                                    <Button className="flex-1">{t("Voir les résultats")}</Button>
                                                </SheetClose>
                                            </SheetFooter>
                                        </SheetContent>
                                    </Sheet>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Tags de filtres actifs — supprimables individuellement.
                        `showActiveFiltersTags` : true/absent = partout · "desktop" =
                        ≥ lg seulement · "mobile" = < lg seulement · false = masqués. */}
                    {props.showActiveFiltersTags !== false && activeFilterTags.length > 0 && (
                        <div
                            className={`${
                                props.showActiveFiltersTags === "mobile"
                                    ? "flex lg:hidden"
                                    : props.showActiveFiltersTags === "desktop"
                                        ? "hidden lg:flex"
                                        : "flex"
                            } mx-auto mt-2 w-full max-w-4xl flex-wrap gap-2 rounded-2xl border border-border/60 bg-card/80 px-3 py-2 shadow-lg backdrop-blur-md`}
                        >
                            {activeFilterTags.map(({ filterId, optionId, label }) => (
                                <Badge key={`${filterId}:${optionId}`} className="gap-1 rounded-full py-1 pe-1">
                                    {label}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const filter = dropdownFilters?.find((f) => f.id === filterId);
                                            if (!filter) return;
                                            const current = getDropdownSelectedValues(filter);
                                            setDropdownSelection(filter, current.filter((v) => v !== optionId));
                                        }}
                                        className="-me-0.5 ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-primary-foreground/15 hover:text-primary-foreground/80"
                                        aria-label={`${t("Supprimer")} ${label}`}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {props.types && props.types.length > 0 && (
                <div className="px-4">
                    <div className="container mx-auto max-w-6xl">
                        <div className="flex flex-wrap gap-3 justify-center">
                            {props.types.map((type) => (
                                <Badge
                                    key={type.id}
                                    variant="outline"
                                    className={`px-4 py-2 cursor-pointer transition-all ${activeType === type.id
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-secondary/30 text-foreground border-primary/30 hover:bg-primary hover:text-primary-foreground hover:border-primary"
                                        }`}
                                    onClick={() => handleTypeChange(type.id)}
                                >
                                    {t(type.label)}
                                </Badge>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

export default SearchHeaderSection;
