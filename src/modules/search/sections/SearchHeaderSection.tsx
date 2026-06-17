/**
 * Header de recherche : titre + sous-titre, boutons d'action (modals/join/href),
 * input texte + `dropdownFilters`, badges `types`. Producteur du
 * `PageFiltersContext` (variante horizontale de `<FiltersSection>`).
 *
 * Type config canonique : `searchHeader`. Alias rétro-compat :
 * (ancien alias `title-with-filters-rezo-la-mer` supprimé — migré vers `searchHeader`).
 */
import "@/modules/search/i18n";
import { useState, useEffect, useMemo } from "react";
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
import { ChevronDown, SlidersHorizontal } from "lucide-react";
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
    const selectedFilters = pageFilters?.selectedFilters ?? {};
    const searchByFields = pageFilters?.searchByFields ?? {};
    const hasDropdownFilters = (props.dropdownFilters?.length ?? 0) > 0;
    const [searchParams] = useSearchParams();

    const activeType = selectedFilters['type']?.[0] ?? "all";

    const { entity } = useCocolight();
    const slugEntity = entity?.slug;

    // Input texte : état local réactif + debounce avant publication dans le
    // context (sinon chaque frappe relance la recherche backend). Même hook et
    // même délai (400 ms) que la sidebar `<FiltersSection>`.
    const [localSearchQuery, setLocalSearchQuery] = useState(pageFilters?.searchQuery ?? "");
    const debouncedSearchQuery = useDebounce(localSearchQuery, 400);
    // Sheet "Filtres" mobile (les dropdowns sont regroupés derrière un bouton)
    const [filtersOpen, setFiltersOpen] = useState(false);

    useEffect(() => {
        setSearchQuery(debouncedSearchQuery);
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

    const setDropdownSelection = (filter: DropdownFilterConfig, nextSelectedIds: string[]) => {
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

    const activeFilterCount = (props.dropdownFilters ?? []).filter(
        (filter) => getDropdownSelectedValues(filter).length > 0
    ).length;

    const resetAllDropdownFilters = () => {
        (props.dropdownFilters ?? []).forEach((filter) => setDropdownSelection(filter, []));
    };

    // Deep-link : applique les dropdownFilters depuis l'URL (`?<filterId>=<optionId,…>`),
    // au montage et à chaque changement de query. Permet à un lien externe (ex. carte de
    // la home « Terrain de football ») d'ouvrir l'annuaire pré-filtré. Param absent → ce
    // filtre est laissé tel quel ; param présent (même vide) → (ré)initialisé depuis l'URL.
    useEffect(() => {
        (props.dropdownFilters ?? []).forEach((filter) => {
            const raw = searchParams.get(filter.id);
            if (raw === null) return;
            const optionIds = raw
                .split(",")
                .map((s) => s.trim())
                .filter((id) => filter.options.some((o) => o.id === id));
            setDropdownSelection(filter, optionIds);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

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
                }))}
                selected={selectedValues}
                onToggle={(id) => toggleDropdownOption(filter, id)}
                allLabel={filter.allLabel ? t(filter.allLabel) : t("Tous")}
                onClear={() => setDropdownSelection(filter, [])}
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
            <div className="inset-0 opacity-10">
                <div className="absolute top-10 left-10 w-64 h-64 bg-primary rounded-full blur-3xl animate-float" />
                <div
                    className="absolute bottom-10 right-10 w-96 h-96 bg-chart-2 rounded-full blur-3xl animate-float"
                    style={{ animationDelay: "2s" }}
                />
            </div>

            <div className="relative z-10 container mx-auto max-w-6xl text-center py-12 px-4">
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
                                    {props.dropdownFilters?.map(renderDropdownFilter)}
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
                                                {props.dropdownFilters?.map(renderDropdownFilter)}
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
