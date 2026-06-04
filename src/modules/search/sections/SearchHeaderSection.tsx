/**
 * Header de recherche : titre + sous-titre, boutons d'action (modals/join/href),
 * input texte + `dropdownFilters`, badges `types`. Producteur du
 * `PageFiltersContext` (variante horizontale de `<FiltersSection>`).
 *
 * Type config canonique : `searchHeader`. Alias rétro-compat :
 * `title-with-filters-rezo-la-mer` (9 configs, cf. plan de refactor).
 */
import "@/modules/search/i18n";
import { useState, useEffect, useMemo } from "react";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useDebounce } from "@/hooks/useDebounce";
import { type SearchHeaderSectionProps } from "@/types/site-schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { ChevronDown } from "lucide-react";
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

    const activeType = selectedFilters['type']?.[0] ?? "all";

    const { entity } = useCocolight();
    const slugEntity = entity?.slug;

    // Input texte : état local réactif + debounce avant publication dans le
    // context (sinon chaque frappe relance la recherche backend). Même hook et
    // même délai (400 ms) que la sidebar `<FiltersSection>`.
    const [localSearchQuery, setLocalSearchQuery] = useState(pageFilters?.searchQuery ?? "");
    const debouncedSearchQuery = useDebounce(localSearchQuery, 400);

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

    return (
        <section id={id} className="relative pt-10 px-4 bg-ocean-gradient overflow-hidden">
            <div className="inset-0 opacity-10">
                <div className="absolute top-10 left-10 w-64 h-64 bg-primary rounded-full blur-3xl animate-float" />
                <div
                    className="absolute bottom-10 right-10 w-96 h-96 bg-chart-2 rounded-full blur-3xl animate-float"
                    style={{ animationDelay: "2s" }}
                />
            </div>

            <div className="relative z-10 container mx-auto max-w-6xl text-center py-12 px-4">
                {props.headline && (
                    <h1 className="text-4xl md:text-6xl font-bold mb-6 text-foreground animate-fade-in">
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
                    <div className={`gap-3 ${hasDropdownFilters ? "flex flex-col lg:flex-row lg:items-center" : ""}`}>
                        {props.showSearch && (
                            <div className={hasDropdownFilters ? "relative flex-1 min-w-[220px]" : "relative"}>
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
                                        ? "pl-12 h-12 rounded-full bg-secondary/40 backdrop-blur-ocean border-primary/30 focus:border-primary text-foreground placeholder:text-muted-foreground"
                                        : "pl-12 h-12 bg-secondary/40 backdrop-blur-ocean border-primary/30 focus:border-primary text-foreground placeholder:text-muted-foreground"
                                    }
                                />
                            </div>
                        )}

                        {hasDropdownFilters && props.dropdownFilters?.map((filter) => {
                            const selectedValues = getDropdownSelectedValues(filter);

                            return (
                                <DropdownMenu key={filter.id}>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="h-12 min-w-[200px] max-w-full justify-between rounded-full border-primary/40 bg-background/85 px-4 text-foreground hover:bg-primary/10 hover:text-foreground"
                                        >
                                            <span className="truncate">{getDropdownTriggerLabel(filter)}</span>
                                            <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-72 max-h-72 overflow-y-auto">
                                        <DropdownMenuItem onClick={() => setDropdownSelection(filter, [])}>
                                            {filter.allLabel ? t(filter.allLabel) : t("Tous")}
                                        </DropdownMenuItem>

                                        {filter.options.length > 0 && <DropdownMenuSeparator />}

                                        {filter.options.map((option) => (
                                            <DropdownMenuCheckboxItem
                                                key={option.id}
                                                checked={selectedValues.includes(option.id)}
                                                onCheckedChange={() => toggleDropdownOption(filter, option.id)}
                                            >
                                                {option.icon && (
                                                    <DynamicIcon
                                                        name={option.icon as IconName}
                                                        className="w-4 h-4 mr-2"
                                                    />
                                                )}
                                                {t(option.label)}
                                            </DropdownMenuCheckboxItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            );
                        })}
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
