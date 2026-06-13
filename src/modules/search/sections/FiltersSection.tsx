import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useLocalization } from "@/hooks/useLocalization";
import "@/modules/search/i18n";
import { cn } from "@/lib/utils";
import type { FiltersSectionProps } from "../schema";
import { useState, useEffect, useMemo } from "react";
import { Check, Search, SlidersHorizontal } from "lucide-react";
import { useFilterToggles } from "../hooks/useFilterToggles";
import { useFiltersByAnswersQuery } from "../hooks/useFiltersByAnswers";
import { useSearchZoneQuery } from "../hooks/useSearchZone";
import { useFilterEntitiesQuery } from "../hooks/useFilterEntities";
import { useFiltersByPathQuery } from "../hooks/useFiltersByPath";
import { useDebounce } from "@/hooks/useDebounce";
import { useSearchParams } from "react-router";
import { computeFiltersFromUrl } from "../lib/computeFiltersFromUrl";
import { SelectField, MultiCheckboxField, MultiField } from "../components/filterFields";
import { pickFilterField } from "../lib/pickFilterField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type ScopeLevel = "cities" | "level1" | "level2" | "level3" | "level4" | "level5";

type FilterGroupOption = NonNullable<FiltersSectionProps["filterGroups"]>[number]["options"] extends infer T
  ? T extends Array<infer U>
    ? U
    : never
  : never;

const FRENCH_OVERSEAS_COUNTRY_CODES = new Set([
  "RE", // Reunion
  "YT", // Mayotte
  "GF", // Guyane
  "GP", // Guadeloupe
  "MQ", // Martinique
  "PM", // Saint-Pierre-et-Miquelon
  "BL", // Saint-Barthelemy
  "MF", // Saint-Martin
  "NC", // Nouvelle-Caledonie
  "PF", // Polynesie francaise
  "WF", // Wallis-et-Futuna
  "TF" // Terres australes et antarctiques francaises
]);

const normalizeCountryCodeForGrouping = (countryCode: string | undefined): string => {
  if (!countryCode) return "ZZ";
  const normalized = countryCode.toUpperCase();
  return FRENCH_OVERSEAS_COUNTRY_CODES.has(normalized) ? "FR" : normalized;
};

const shouldGroupScopeListByCountry = (levels: string[] | undefined, countryCode: string[] | undefined): boolean => {
  if (!levels || levels.length === 0) return false;
  if(!countryCode || countryCode.length === 0 || countryCode.length === 1) return false;
  return !levels.includes("1");
};

const getOptionCountryCode = (option: FilterGroupOption): string | undefined => {
  const raw = (option as { countryCode?: unknown }).countryCode;
  return typeof raw === "string" ? raw : undefined;
};

/** Ligne d'option de filtre (Checkbox + Label shadcn). Présentationnel,
 *  partagé par le rendu groupé-par-pays, le rendu simple et les groupes
 *  « par réponses ». */
function FilterOptionRow({
  label,
  selected,
  onToggle,
  variant = "checkbox",
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
  /** "check" : ligne à coche à DROITE (look SelectItem) — cf. optionStyle. */
  variant?: "checkbox" | "check";
}) {
  if (variant === "check") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className={cn(
          "h-8 w-full justify-between px-2 font-normal",
          selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <span className="truncate">{label}</span>
        <Check className={cn("h-4 w-4 shrink-0", selected ? "opacity-100" : "opacity-0")} />
      </Button>
    );
  }
  return (
    <Label className="group flex cursor-pointer items-start gap-2 font-normal">
      <Checkbox checked={selected} onCheckedChange={onToggle} className="mt-0.5" />
      <span className="flex-1 text-sm text-muted-foreground group-hover:text-foreground">
        {label}
      </span>
    </Label>
  );
}

export function FiltersSection({
  id,
  props
}: {
  id?: string;
  props: FiltersSectionProps
}) {
  useLoadNamespace("modules/search");
  const t = useT("modules/search");
  const { currentLocale } = useLocalization();
  const [sheetOpen, setSheetOpen] = useState(false);
  // Tri alphabétique des options de filtre par libellé localisé (tous les groupes).
  // `.trim()` neutralise les espaces/caractères invisibles en tête de certaines
  // valeurs backend (sinon elles remontent en haut de liste).
  const byLabel = (a: string, b: string) =>
    (a ?? "").trim().localeCompare((b ?? "").trim(), currentLocale, { sensitivity: "base" });
  // Normalise la casse d'affichage des valeurs backend (casse incohérente :
  // "bar" / "Bureautiques") → 1ʳᵉ lettre en majuscule.
  const capitalizeFirst = (s: string) => {
    const v = (s ?? "").trim();
    return v ? v.charAt(0).toUpperCase() + v.slice(1) : v;
  };
  const { title, filterGroups: propsFiltersGroups, defaultOpenGroups = [], filtersByAnswers, filtersByPath, className } = props;
  const [filterGroups, setFilterGroups] = useState<FiltersSectionProps["filterGroups"]>([]);
  const [openGroups, setOpenGroups] = useState<string[]>(defaultOpenGroups);

  // Deux sources de filtres "par réponses" produisant le même shape :
  //  - filtersByAnswers → coformFiltersSearch (batch, existant)
  //  - filtersByPath    → coformFilterByPath (par thématique, nouveau)
  // On les merge dans un seul `filterAnswerData` → rendu + sélection communs.
  const filtersByAnswersOptions = filtersByAnswers ?? {};
  const filterAnswerResult = useFiltersByAnswersQuery(`filters-answers-${id}`, filtersByAnswersOptions as Parameters<typeof useFiltersByAnswersQuery>[1]);
  const countryDisplayNames = useMemo(() => {
    if (typeof Intl === "undefined" || typeof Intl.DisplayNames === "undefined") {
      return null;
    }

    const supportedLocales = Intl.DisplayNames.supportedLocalesOf([currentLocale, "fr", "en"]);
    const localeToUse = supportedLocales[0] ?? "fr";
    return new Intl.DisplayNames([localeToUse], { type: "region" });
  }, [currentLocale]);

  const filtersByPathOptions = filtersByPath ?? {};
  const filterByPathResult = useFiltersByPathQuery(`filters-by-path-${id}`, filtersByPathOptions as Parameters<typeof useFiltersByPathQuery>[1]);

  const filterAnswerData = useMemo(() => {
    if (!filtersByAnswers && !filtersByPath) return null;
    return { ...(filtersByAnswers ? filterAnswerResult.data : {}), ...(filtersByPath ? filterByPathResult.data : {}) };
  }, [filtersByAnswers, filtersByPath, filterAnswerResult.data, filterByPathResult.data]);

  const zoneQueryParams = useMemo(() => {
    const hasScopeList = propsFiltersGroups.some(group => group.type === "scopeList");
    if (!hasScopeList) return null;

    return propsFiltersGroups.filter(group => group.type === "scopeList").reduce((acc, group) => {
      if (!acc.countryCode) {
        acc.countryCode = []
      }
      if (!acc.level) {
        acc.level = []
      }
      if (group.config?.countryCode) {
        acc.countryCode.push(...group.config.countryCode);
      }
      if (group.config?.level) {
        acc.level.push(...group.config.level);
      }
      // Rendre les valeurs uniques
      acc.countryCode = [...new Set(acc.countryCode)];
      acc.level = [...new Set(acc.level)];
      return acc;
    }, {} as { countryCode: string[]; level: string[] });
  }, [propsFiltersGroups]);

  const zoneResult = useSearchZoneQuery(`filters-zone-${id}`, zoneQueryParams ?? { countryCode: [], level: [] });
  const filterZoneData = zoneQueryParams ? zoneResult.data : null;

  // entityList : un seul groupe supporté par section (suffit pour les réseaux
  // régionaux). La query est désactivée si aucun groupe entityList n'est déclaré
  // (baseParams vide → enabled false côté hook).
  const entityListGroup = useMemo(
    () => propsFiltersGroups?.find((g) => g.type === "entityList"),
    [propsFiltersGroups]
  );
  const entityResult = useFilterEntitiesQuery(
    `filters-entities-${id}-${entityListGroup?.id ?? "none"}`,
    entityListGroup?.baseParams ?? {},
    entityListGroup?.filterBy ?? "slug"
  );
  const filterEntityData = entityListGroup ? entityResult.data : null;

  // Context partagé + logique de toggle mutualisée (cf. useFilterToggles).
  const { selectedFilters, setSelectedFilters, searchQuery, setSearchQuery, clearFilters: clearFiltersContext, searchByFields, setSearchByFields, toggleFilter } = useFilterToggles();

  // Input texte : état local réactif visuellement + debounce avant de publier
  // dans le context (sinon chaque frappe relance `searchCostum` côté backend).
  const [searchInput, setSearchInput] = useState<string>(searchQuery);
  const debouncedSearchInput = useDebounce(searchInput, 400);

  useEffect(() => {
    if (debouncedSearchInput !== searchQuery) {
      setSearchQuery(debouncedSearchInput);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchInput]);

  // Synchro inverse : si le context est vidé de l'extérieur (clearFilters,
  // navigation, etc.), l'input local doit suivre pour ne pas afficher du texte
  // fantôme.
  useEffect(() => {
    if (searchQuery === "" && searchInput !== "") {
      setSearchInput("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);
  // Initialiser les filtres par défaut (defaultChecked)
  useEffect(() => {
    const initialFilters: Record<string, string[]> = {};
    const newFilterGroups: FiltersSectionProps["filterGroups"] = [];
    propsFiltersGroups?.forEach(group => {

      if (!group.options) group.options = [];
      if (group.type === "scopeList") {
        group.options = [];
        const groupByCountry = shouldGroupScopeListByCountry(group.config?.level, group.config?.countryCode);
        // Remplir les options à partir des données de zone
        filterZoneData?.forEach(zone => {
          if (group.config && group.config.level && !zone.level.some(lvl => group.config?.level?.includes(lvl))) {
            return;
          }
          if(group.config?.countryCode && !group.config.countryCode.includes(normalizeCountryCodeForGrouping(zone.countryCode as string | undefined))) {
            return;
          }
          // Libellés par langue : `zone.name` par défaut, enrichi par les
          // traductions réelles de la zone si présentes (`zone.translate.translates`).
          const label: Record<string, string> = {
            fr: zone.name,
            en: zone.name,
            es: zone.name,
          };
          if (
            zone.translate &&
            typeof zone.translate === "object" &&
            typeof (zone.translate as Record<string, unknown>).translates === "object"
          ) {
            const translates = (zone.translate as Record<string, Record<string, string>>).translates;
            Object.keys(translates).forEach((lang) => {
              label[lang.toLowerCase()] = translates[lang];
            });
          }
          const data = {
            id: zone.id as string,
            label,
            level: (zone.level.length === 1 ? `level${zone.level[0]}` : `level${group.config?.level ? Math.min(...group.config.level.map(lvl => parseInt(lvl, 10))) : zone.level[0]}`) as ScopeLevel,
            // Keep the source country to allow grouped rendering by country for levels > 1.
            ...(groupByCountry ? { countryCode: normalizeCountryCodeForGrouping(zone.countryCode as string | undefined) } : {})
          };
          group.options?.push(data);
        });
        newFilterGroups.push(group);
      } else if (group.type === "entityList") {
        // Options peuplées dynamiquement depuis la recherche d'entités.
        // `name` = slug (valeur utilisée par le filtre sourceKey).
        group.options = (filterEntityData ?? []).map((e) => ({
          id: e.value,
          label: { fr: e.name, en: e.name, es: e.name },
          name: e.value,
        }));
        newFilterGroups.push(group);
      } else {
        const defaultCheckedIds = (group.options ?? [])
          .filter(option => option.defaultChecked)
          .map(option => option.name || option.id);

        if (defaultCheckedIds.length > 0) {
          initialFilters[group.id] = defaultCheckedIds;
        }
        newFilterGroups.push(group);
      }
    });

    if (Object.keys(initialFilters).length > 0) {
      setSelectedFilters(initialFilters);
    }
    setFilterGroups(newFilterGroups);
  }, [propsFiltersGroups, filterZoneData, filterEntityData, setSelectedFilters]);

  const [searchParams] = useSearchParams();

  // Recherche texte reportée depuis l'URL (`?search=`) — ex. lien « voir sur /lieux »
  // de la home, qui transporte la saisie texte en plus des filtres catégorie.
  useEffect(() => {
    const urlSearch = searchParams.get("search");
    if (urlSearch && urlSearch !== searchQuery) {
      setSearchInput(urlSearch);
      setSearchQuery(urlSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (filterGroups.length === 0 && !filterAnswerData) return;
    const { applySelected, applySearchFields } = computeFiltersFromUrl(
      searchParams,
      filterGroups,
      filterAnswerData,
    );
    setSelectedFilters(applySelected);
    setSearchByFields(applySearchFields);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, filterGroups, filterAnswerData]);

  const clearFilters = () => {
    clearFiltersContext();
  };

  const isFilterSelected = (groupId: string, filterName: string) =>
    (selectedFilters[groupId] || []).includes(filterName) || Object.keys(searchByFields).includes(filterName);

  const getGroupActiveCount = (groupId: string, optionNames: string[]) => {
    const selected = selectedFilters[groupId] || [];
    const fromSelected = selected.length;
    const fromSearchFields = optionNames.filter(name => Object.keys(searchByFields).includes(name)).length;
    return fromSelected + fromSearchFields;
  };

  const hasActiveFilters = Object.values(selectedFilters).some(arr => arr.length > 0) || searchQuery.length > 0 || Object.keys(searchByFields).length > 0;

  // Compteur global (badge du bouton mobile) : sélections + champs recherchés.
  const totalActiveCount =
    Object.values(selectedFilters).reduce((n, arr) => n + arr.length, 0) +
    Object.keys(searchByFields).length +
    (searchQuery.length > 0 ? 1 : 0);

  /* Bouton Effacer — partagé desktop / Sheet mobile. */
  const clearButton = (
    <Button
      variant="ghost"
      size="sm"
      onClick={clearFilters}
      disabled={!hasActiveFilters}
      className={cn(
        "h-7 px-2 text-xs",
        hasActiveFilters ? "text-primary hover:text-primary" : "text-muted-foreground/50",
      )}
    >
      {t("Effacer")}
    </Button>
  );

  /* Widget compact (matrice observatoire) — partagé par les groupes statiques
     ET « par réponses ». `value`/`onChange` parlent la CSV (format URL maison) ;
     la sélection réelle reste pilotée par toggleFilter (logique inchangée). */
  const renderCompactField = (
    selectConf: { multiple?: boolean; searchable?: boolean },
    fieldLabel: string,
    value: string,
    fieldOptions: Array<{ id: string; label: string }>,
    onChange: (csv: string) => void,
  ) => {
    const kind = pickFilterField(selectConf);
    return (
      <>
        {kind === "select" && (
          <SelectField label={fieldLabel} value={value} onChange={onChange} options={fieldOptions} allLabel={t("Tous")} />
        )}
        {kind === "multi-checkbox" && (
          <MultiCheckboxField
            label={fieldLabel}
            value={value}
            onChange={onChange}
            options={fieldOptions}
            allLabel={t("Tous")}
            selectedCountLabel={(n) => t("{{count}} sélectionnés", undefined, { count: n })}
          />
        )}
        {(kind === "multi" || kind === "multi-single") && (
          <MultiField
            label={fieldLabel}
            value={value}
            onChange={onChange}
            options={fieldOptions}
            allLabel={t("Tous")}
            noResult={t("Aucun résultat")}
            single={kind === "multi-single"}
          />
        )}
      </>
    );
  };

  /* Corps (recherche + groupes) — UN SEUL rendu, affiché dans la sidebar
     desktop ET dans le Sheet mobile. Groupes en Accordion shadcn contrôlé
     (openGroups reste la source de vérité — defaultOpenGroups respecté). */
  /* Champ de recherche — séparé du corps : sur mobile il vit AU-DESSUS du
     bouton « Filtres » (directement accessible, sans ouvrir le Sheet). */
  const searchField = (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder={t("Rechercher par nom...")}
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="pl-9"
      />
    </div>
  );

  const body = (
    <>
      <Accordion type="multiple" value={openGroups} onValueChange={setOpenGroups} className="w-full">
        {filterGroups?.map((group) => {
          const groupOptionNames = (group.options ?? []).map(o => o.name || o.id);
          const activeCount = getGroupActiveCount(group.id, groupOptionNames);
          const isActive = activeCount > 0;
          const groupByCountry = group.type === "scopeList" && shouldGroupScopeListByCountry(group.config?.level, group.config?.countryCode);
          const groupedOptions = groupByCountry
            ? (group.options ?? []).reduce<Record<string, FilterGroupOption[]>>((acc, option) => {
                const countryCode = normalizeCountryCodeForGrouping(getOptionCountryCode(option));
                if (!acc[countryCode]) {
                  acc[countryCode] = [];
                }
                acc[countryCode].push(option);
                return acc;
              }, {})
            : null;
          const configuredCountryOrder = [...new Set((group.config?.countryCode ?? []).map(normalizeCountryCodeForGrouping))];
          const remainingCountryCodes = groupedOptions
            ? Object.keys(groupedOptions).filter(code => !configuredCountryOrder.includes(code)).sort()
            : [];
          const countryOrder = groupedOptions
            ? [...configuredCountryOrder, ...remainingCountryCodes].filter(code => groupedOptions[code]?.length > 0)
            : [];
          const renderOption = (option: FilterGroupOption) => {
            const filterName = option.name || option.id;
            return (
              <FilterOptionRow
                key={option.id}
                label={t(option.label)}
                variant={group.optionStyle}
                selected={isFilterSelected(group.id, filterName)}
                onToggle={() =>
                  group.type === "scopeList"
                    ? toggleFilter(group.id, filterName, group.field ?? `${option.id}${option.level}`, filterName, option.level as ScopeLevel)
                    : toggleFilter(group.id, filterName)
                }
              />
            );
          };
          // Widget COMPACT déclaré en config (matrice observatoire) : le champ
          // remplace l'accordéon. onChange reçoit la CSV complète → diff puis
          // toggleFilter par changement (la logique de sélection est inchangée).
          if (group.select) {
            const fieldOptions = [...(group.options ?? [])]
              .sort((a, b) => byLabel(t(a.label), t(b.label)))
              .map((o) => ({ id: o.name || o.id, label: t(o.label) }));
            // Valeur affichée = MÊME sémantique qu'isFilterSelected : les
            // groupes scopeList stockent leur sélection dans searchByFields
            // (pas selectedFilters) — sans cette union, le trigger resterait
            // sur « Tous » après sélection.
            const selectedNames = [...new Set([
              ...(selectedFilters[group.id] || []),
              ...(group.options ?? [])
                .map((o) => o.name || o.id)
                .filter((n) => Object.keys(searchByFields).includes(n)),
            ])];
            const value = selectedNames.join(",");
            const applyCsv = (csv: string) => {
              const next = csv.split(",").map((v) => v.trim()).filter(Boolean);
              const current = selectedNames;
              const changed = [
                ...next.filter((n) => !current.includes(n)),
                ...current.filter((c) => !next.includes(c)),
              ];
              for (const name of changed) {
                const option = (group.options ?? []).find((o) => (o.name || o.id) === name);
                if (group.type === "scopeList" && option) {
                  toggleFilter(group.id, name, group.field ?? `${option.id}${option.level}`, name, option.level as ScopeLevel);
                } else {
                  toggleFilter(group.id, name);
                }
              }
            };
            return (
              <div key={group.id} className="py-2">
                {renderCompactField(group.select, t(group.label), value, fieldOptions, applyCsv)}
              </div>
            );
          }
          return (
            <AccordionItem key={group.id} value={group.id}>
              <AccordionTrigger className="py-3 text-sm hover:no-underline">
                <span className={cn("flex items-center gap-2 font-medium", isActive ? "text-primary" : "text-foreground")}>
                  {t(group.label)}
                  {isActive && <Badge className="rounded-full px-1.5">{activeCount}</Badge>}
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-2 pb-3">
                {groupByCountry && groupedOptions ? (
                  countryOrder.map(countryCode => {
                    const countryOptions = groupedOptions[countryCode] ?? [];
                    const countryLabel = countryDisplayNames?.of(countryCode) ?? countryCode;
                    return (
                      <div key={`${group.id}-${countryCode}`} className="space-y-2">
                        <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
                          {countryLabel}
                        </p>
                        {countryOptions.sort((a, b) => byLabel(t(a.label), t(b.label))).map(renderOption)}
                      </div>
                    );
                  })
                ) : (
                  [...(group.options ?? [])].sort((a, b) => byLabel(t(a.label), t(b.label))).map(renderOption)
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}

        {Object.keys(filterAnswerData ?? {}).map((group) => {
          const groupData = filterAnswerData?.[group];
          if (!groupData) return null;
          const answerOptionNames = Object.keys(groupData.values);
          if (answerOptionNames.length === 0) return null;
          const answerActiveCount = getGroupActiveCount(group, answerOptionNames);
          const answerIsActive = answerActiveCount > 0;
          const headerLabel = (
            <span className={cn("flex items-center gap-2 font-medium", answerIsActive ? "text-primary" : "text-foreground")}>
              {t(groupData.label)}
              {answerIsActive && <Badge className="rounded-full px-1.5">{answerActiveCount}</Badge>}
            </span>
          );
          // Widget COMPACT déclaré en config (filtersByAnswers/Path[group].select) :
          // remplace l'accordéon. La sélection des groupes « par réponses » vit
          // dans searchByPath/_id (orgaNameArray) — isFilterSelected en tient compte.
          const answerSelectConf = filtersByAnswersOptions[group]?.select ?? filtersByPathOptions[group]?.select;
          if (answerSelectConf) {
            const fieldOptions = [...answerOptionNames]
              .sort((a, b) => byLabel(groupData.values[a].name, groupData.values[b].name))
              .map((k) => ({ id: k, label: capitalizeFirst(groupData.values[k].name) }));
            const selectedNames = answerOptionNames.filter((k) => isFilterSelected(group, k));
            const value = selectedNames.join(",");
            const applyCsv = (csv: string) => {
              const next = csv.split(",").map((v) => v.trim()).filter(Boolean);
              const changed = [
                ...next.filter((n) => !selectedNames.includes(n)),
                ...selectedNames.filter((c) => !next.includes(c)),
              ];
              for (const name of changed) {
                toggleFilter(group, name, "_id", groupData.values[name].orgaNameArray);
              }
            };
            return (
              <div key={group} className="py-2">
                {renderCompactField(answerSelectConf, t(groupData.label), value, fieldOptions, applyCsv)}
              </div>
            );
          }
          // Groupe à valeur UNIQUE : pas d'accordéon — le titre EST le toggle.
          if (answerOptionNames.length === 1) {
            const singleKey = answerOptionNames[0];
            const singleValue = groupData.values[singleKey];
            return (
              <Button
                key={group}
                variant="ghost"
                onClick={() => toggleFilter(group, group, "_id", singleValue.orgaNameArray)}
                className="h-auto w-full justify-between rounded-none border-b border-border py-3 text-sm font-normal hover:bg-muted"
              >
                {headerLabel}
              </Button>
            );
          }
          return (
            <AccordionItem key={group} value={group}>
              <AccordionTrigger className="py-3 text-sm hover:no-underline">{headerLabel}</AccordionTrigger>
              <AccordionContent className="space-y-2 pb-3">
                {answerOptionNames
                  .sort((a, b) => byLabel(groupData.values[a].name, groupData.values[b].name))
                  .map((optionKey) => {
                    const option = groupData.values[optionKey];
                    return (
                      <FilterOptionRow
                        key={optionKey}
                        label={capitalizeFirst(option.name)}
                        variant={filtersByAnswersOptions[group]?.optionStyle ?? filtersByPathOptions[group]?.optionStyle}
                        selected={isFilterSelected(group, optionKey)}
                        onToggle={() => toggleFilter(group, optionKey, "_id", option.orgaNameArray)}
                      />
                    );
                  })}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </>
  );

  return (
    <div id={id} className={className}>
      {/* Mobile (< lg — le breakpoint d'empilement du gridLayout) : bouton +
          Sheet bas. Bascule PUR CSS (pas de useIsMobile) : le SSR et le 1ᵉʳ
          rendu client sont déjà corrects — aucun flash desktop→mobile. */}
      <div className="space-y-2 lg:hidden">
        {searchField}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="h-11 w-full justify-between rounded-xl px-3">
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                {title ? t(title) : t("Filtres")}
              </span>
              {totalActiveCount > 0 && (
                <Badge className="ml-2 rounded-full px-2">{totalActiveCount}</Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] gap-0 rounded-t-2xl p-0">
            {/* pr-12 : la croix de fermeture (top-4 right-4) a SA place — elle
                ne chevauche plus le bouton Effacer. */}
            <SheetHeader className="flex-row items-center justify-between space-y-0 border-b border-border py-3 pl-4 pr-12">
              <SheetTitle className="flex items-center gap-2 text-base">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                {title ? t(title) : t("Filtres")}
                {totalActiveCount > 0 && (
                  <Badge className="rounded-full px-2">{totalActiveCount}</Badge>
                )}
              </SheetTitle>
              {clearButton}
            </SheetHeader>
            <div className="overflow-y-auto px-4 pt-1">{body}</div>
            <SheetFooter className="flex-row gap-2 border-t border-border">
              <SheetClose asChild>
                <Button className="flex-1">{t("Voir les résultats")}</Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop : sidebar. */}
      <aside className="hidden rounded-lg border border-border bg-card p-4 lg:block">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">{title ? t(title) : t("Filtres")}</h3>
          </div>
          {clearButton}
        </div>
        <div className="border-b border-border pb-4">{searchField}</div>
        {body}
      </aside>
    </div>
  );
}
export default FiltersSection;
