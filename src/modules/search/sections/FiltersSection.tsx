import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useLocalization } from "@/hooks/useLocalization";
import { useCountryDisplayNames } from "@/hooks/useCountryDisplayNames";
import "@/modules/search/i18n";
import { cn } from "@/lib/utils";
import type { FiltersSectionProps } from "../schema";
import { useState, useEffect, useMemo, useRef, type ReactElement, type ReactNode } from "react";
import { useDynamicFilterOptions } from "@/modules/search/hooks/useDynamicFilterOptions";
import { Check, ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { useFilterToggles } from "../hooks/useFilterToggles";
import { useFiltersByAnswersQuery } from "../hooks/useFiltersByAnswers";
import { useSearchZoneQuery } from "../hooks/useSearchZone";
import { useFilterEntitiesQuery } from "../hooks/useFilterEntities";
import { useFiltersByPathQuery } from "../hooks/useFiltersByPath";
import { useDebounce } from "@/hooks/useDebounce";
import { useSearchParams } from "react-router";
import { applyDefaultSearchTargets, computeFiltersFromUrl } from "../lib/computeFiltersFromUrl";
import { normalizeFilterValue } from "../lib/dropdownFilters";
import { computeUrlFromFilters } from "../lib/computeUrlFromFilters";
import { SelectField, MultiCheckboxField, MultiField } from "../components/filterFields";
import { pickFilterField } from "../lib/pickFilterField";
import { answerToggleArgs, type AnswerGroupConf } from "../lib/answerFilterClause";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

/** Compteur de filtres actifs : pastille RONDE pour un chiffre (min-w = h),
 *  s'allonge en pilule pour 2+ chiffres. Le `Badge` par défaut (px-2, w-fit)
 *  donne un ovale sur un seul chiffre. */
const COUNT_BADGE_CLASS = "h-5 min-w-5 justify-center rounded-full px-1 tabular-nums";

/** Ligne d'option de filtre (Checkbox + Label shadcn). Présentationnel,
 *  partagé par le rendu groupé-par-pays, le rendu simple et les groupes
 *  « par réponses ». */
function FilterOptionRow({
  label,
  selected,
  onToggle,
  variant = "checkbox",
  dotColor,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
  /** "check" : ligne à coche à DROITE (look SelectItem) — cf. optionStyle. */
  variant?: "checkbox" | "check";
  /** Pastille de couleur de l'option (ex. territoire — `options[].color`). */
  dotColor?: string;
}) {
  const dot = dotColor ? (
    <span
      aria-hidden
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: dotColor }}
    />
  ) : null;
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
        <span className="flex min-w-0 items-center gap-2">
          {dot}
          <span className="truncate">{label}</span>
        </span>
        <Check className={cn("h-4 w-4 shrink-0", selected ? "opacity-100" : "opacity-0")} />
      </Button>
    );
  }
  return (
    <Label className="group flex cursor-pointer items-start gap-2 font-normal">
      <Checkbox checked={selected} onCheckedChange={onToggle} className="mt-0.5" />
      {dot && <span className="mt-1">{dot}</span>}
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
  const { title, filterGroups: propsFiltersGroupsBruts, defaultOpenGroups = [], filtersByAnswers, filtersByPath, className } = props;
  // Options DYNAMIQUES résolues AVANT l'enrichissement : l'effet ci-dessous dépend de cette liste, il se
  // rejoue donc quand les valeurs arrivent, `setFilterGroups` suit, et la synchro URL — déjà continue
  // ici — restaure le deep-link. Un groupe sans `optionsFrom` traverse inchangé, sans aucune requête.
  // Recherche PAR GROUPE dans la liste d'options (barre latérale). Une liste dynamique suit les données :
  // institutBleu compte 1 209 tags de documents et 565 auteurs — un accordéon de 1 209 cases n'est pas
  // parcourable, et les monter tous coûte au rendu. Au-delà des seuils : champ de recherche + plafond.
  //
  // Le même terme sert DEUX fois : il filtre localement ce qu'on tient, et — pour une liste que le
  // serveur a coupée — il repart en `q` pour chercher au-delà de la coupe. Le debounce ne vaut que pour
  // le second usage ; le filtrage local, lui, reste à la frappe.
  const [rechercheGroupe, setRechercheGroupe] = useState<Record<string, string>>({});
  const rechercheGroupeDebounce = useDebounce(rechercheGroupe, 300);
  const propsFiltersGroups = useDynamicFilterOptions(propsFiltersGroupsBruts, rechercheGroupeDebounce);
  const [filterGroups, setFilterGroups] = useState<FiltersSectionProps["filterGroups"]>([]);
  const [openGroups, setOpenGroups] = useState<string[]>(defaultOpenGroups);

  // Deux sources de filtres "par réponses" produisant le même shape :
  //  - filtersByAnswers → coformFiltersSearch (batch, existant)
  //  - filtersByPath    → coformFilterByPath (par thématique, nouveau)
  // On les merge dans un seul `filterAnswerData` → rendu + sélection communs.
  const filtersByAnswersOptions = filtersByAnswers ?? {};
  const filterAnswerResult = useFiltersByAnswersQuery(`filters-answers-${id}`, filtersByAnswersOptions as Parameters<typeof useFiltersByAnswersQuery>[1]);
  const countryDisplayNames = useCountryDisplayNames();

  const filtersByPathOptions = filtersByPath ?? {};
  const filterByPathResult = useFiltersByPathQuery(`filters-by-path-${id}`, filtersByPathOptions as Parameters<typeof useFiltersByPathQuery>[1]);

  // Config des groupes « par réponses », indexée par id — passée à la lecture d'URL
  // pour qu'un deep-link pose EXACTEMENT le même filtre qu'un clic (cf. filterTarget).
  const answerGroupConfs = useMemo<Record<string, AnswerGroupConf>>(
    () => ({ ...filtersByAnswersOptions, ...filtersByPathOptions }) as Record<string, AnswerGroupConf>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(filtersByAnswersOptions), JSON.stringify(filtersByPathOptions)],
  );

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
  const { selectedFilters, setSelectedFilters, searchQuery, setSearchQuery, clearFilters: clearFiltersContext, searchByFields, setSearchByFields, toggleFilter, toggleTarget, setRange } = useFilterToggles();

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
      } else if (group.type === "searchTargets") {
        // Une cible pré-cochée ne passe JAMAIS par selectedFilters : elle
        // fuirait en tag `$all` inexistant (typeinfo-…) et viderait la
        // recherche. Le défaut est appliqué dans searchByFields à
        // l'hydratation URL (applyDefaultSearchTargets, effet ci-dessous).
        newFilterGroups.push(group);
      } else if (group.field) {
        // Groupe « champ » (territoires/publics/thèmes) : même règle que
        // searchTargets. Une option `defaultChecked` cible un CHAMP du document
        // et doit vivre dans searchByFields → `{champ:{$in}}` ; routée par
        // selectedFilters elle partirait en tag `$all` inexistant (recherche
        // vidée). Le défaut est appliqué dans searchByFields à l'hydratation
        // (applyDefaultSearchTargets).
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

  const [searchParams, setSearchParams] = useSearchParams();
  // Synchro URL ⇄ filtres. L'URL est un MIROIR écrit en `replace` ; le contexte
  // `PageFilters` reste la source de vérité.
  //  - `lastSyncedSearch` mémorise notre dernière écriture → l'effet de lecture
  //    ignore son propre écho (sinon re-dérivation inutile à chaque clic).
  //  - `urlHydrated` n'autorise l'écriture qu'APRÈS la 1ʳᵉ lecture : au montage,
  //    l'état est encore vide et écrirait une URL nue, effaçant un éventuel
  //    deep-link `?reseauxRegionaux=…` avant qu'il soit hydraté.
  const lastSyncedSearch = useRef<string | null>(null);
  const [urlHydrated, setUrlHydrated] = useState(false);

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

  // URL → état. Continu (deep-link, liens d'accueil, back/forward) mais on saute
  // nos propres écritures (écho) repérées via `lastSyncedSearch`.
  // Un groupe à source dynamique dont les valeurs n'ont pas répondu bloque l'hydratation. Sans ça, la
  // première lecture ne reconnaît aucune valeur, `urlHydrated` passe quand même à vrai, et l'effet
  // d'écriture ci-dessous EFFACE le paramètre de l'URL avant que les valeurs n'arrivent — le deep-link
  // est détruit au lieu d'être simplement retardé.
  const optionsEnAttente = (filterGroups ?? []).some(
    (g) => (g as { optionsFrom?: unknown; optionsReady?: boolean }).optionsFrom
      && !(g as { optionsReady?: boolean }).optionsReady,
  );

  useEffect(() => {
    if (optionsEnAttente) return;
    if (filterGroups.length === 0 && !filterAnswerData) return;
    if (searchParams.toString() === lastSyncedSearch.current) {
      if (!urlHydrated) setUrlHydrated(true);
      return;
    }
    const { applySelected, applySearchFields } = computeFiltersFromUrl(
      searchParams,
      filterGroups,
      filterAnswerData,
      answerGroupConfs,
    );
    setSelectedFilters(applySelected);
    // À l'hydratation initiale SEULEMENT : sélection par défaut des groupes
    // searchTargets (option defaultChecked) si l'URL n'impose rien — ensuite,
    // une URL sans param signifie « décoché par l'utilisateur ».
    const seedDefaults = !urlHydrated;
    setSearchByFields((prev) => {
      const fromUrl = applySearchFields(prev);
      return seedDefaults ? applyDefaultSearchTargets(fromUrl, filterGroups, searchParams) : fromUrl;
    });
    if (!urlHydrated) setUrlHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, filterGroups, filterAnswerData, optionsEnAttente]);

  // état → URL. Miroir des filtres (texte `search`, category, entityList,
  // scopeList — cf. computeUrlFromFilters). Démarre seulement après l'hydratation
  // initiale et n'écrit que sur changement réel (comparaison de chaîne) → pas de
  // boucle avec l'effet de lecture.
  useEffect(() => {
    if (!urlHydrated) return;
    const next = computeUrlFromFilters(searchParams, selectedFilters, searchByFields, filterGroups, searchQuery, filterAnswerData);
    const nextStr = next.toString();
    if (nextStr === searchParams.toString()) return;
    lastSyncedSearch.current = nextStr;
    setSearchParams(next, { replace: true, preventScrollReset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFilters, searchByFields, filterGroups, searchQuery, filterAnswerData, searchParams, urlHydrated]);

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
            searchPlaceholder={t("Rechercher…")}
            noResult={t("Aucun résultat")}
            moreLabel={(n) => t("+{{count}} autres — précisez la recherche", undefined, { count: n })}
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

  /* Groupe repliable — UN `Collapsible` shadcn PAR groupe (et non un `Accordion`
     partagé) : les champs compacts (`select`) et boutons valeur-unique sont
     interleavés librement avec les groupes accordéon sans casser Radix (qui
     n'accepte que des `AccordionItem` comme enfants de `Accordion.Root`).
     `openGroups` reste la source de vérité (defaultOpenGroups respecté). */
  const toggleGroupOpen = (key: string) =>
    setOpenGroups((prev) => (prev.includes(key) ? prev.filter((g) => g !== key) : [...prev, key]));
  const renderGroupCollapsible = (
    key: string,
    header: React.ReactNode,
    contentClass: string,
    children: React.ReactNode,
  ) => (
    <Collapsible
      key={key}
      open={openGroups.includes(key)}
      onOpenChange={() => toggleGroupOpen(key)}
      className="border-b border-border last:border-b-0"
    >
      <CollapsibleTrigger className="group/trig flex w-full items-center justify-between py-3 text-sm outline-none">
        {header}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/trig:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className={cn("pb-3", contentClass)}>{children}</CollapsibleContent>
    </Collapsible>
  );

  /* État de CHARGEMENT d'un groupe dont les options viennent d'une query
     (zones, entités, réponses CoForm) : le groupe garde sa PLACE et son
     libellé — squelette de champ (compact) ou en-tête + spinner (accordéon) —
     au lieu de disparaître/apparaître brusquement. */
  const renderGroupLoading = (key: string, label: string, compact: boolean) =>
    compact ? (
      <div key={key} className="flex flex-col gap-1.5 py-2">
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
        <Skeleton className="h-8 w-full rounded-md" />
      </div>
    ) : (
      <div key={key} className="flex items-center justify-between border-b border-border py-3 last:border-b-0">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <Spinner className="size-4 text-muted-foreground" />
      </div>
    );

  /* Liste d'options d'un groupe accordéon, avec RECHERCHE et PLAFOND de rendu au-delà des seuils.
     Motif : une liste `optionsFrom` suit les données et n'est plus bornée par la config — 1 209 tags de
     documents et 565 auteurs sur institutBleu. En deçà du seuil, le rendu est exactement l'ancien (aucun
     champ ajouté sur les 8 catégories d'un annuaire).
     Les options SÉLECTIONNÉES passent en tête : sans cela, cocher une valeur puis la voir sortir du
     plafond la rendrait impossible à décocher autrement que par la barre des filtres actifs. */
  const SEUIL_RECHERCHE_GROUPE = 12;
  const MAX_OPTIONS_RENDUES = 60;
  const renderOptionsCherchables = (
    groupId: string,
    options: FilterGroupOption[],
    render: (o: FilterGroupOption) => ReactNode,
    estSelectionnee: (o: FilterGroupOption) => boolean,
  ): ReactNode => {
    if (options.length <= SEUIL_RECHERCHE_GROUPE) return options.map(render);
    const q = rechercheGroupe[groupId] ?? "";
    const qn = normalizeFilterValue(q);
    const filtrees = qn
      ? options.filter((o) => normalizeFilterValue(t(o.label)).includes(qn))
      : options;
    const ordonnees = [...filtrees].sort((a, b) => Number(estSelectionnee(b)) - Number(estSelectionnee(a)));
    const rendues = ordonnees.slice(0, MAX_OPTIONS_RENDUES);
    const reste = ordonnees.length - rendues.length;
    return (
      <>
        <div className="relative pb-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={q}
            onChange={(e) => setRechercheGroupe((prev) => ({ ...prev, [groupId]: e.target.value }))}
            placeholder={t("Rechercher…")}
            className="h-8 pl-7 text-sm"
          />
        </div>
        {rendues.map(render)}
        {ordonnees.length === 0 && (
          <p className="px-1 py-1 text-xs text-muted-foreground">{t("Aucun résultat")}</p>
        )}
        {reste > 0 && (
          <p className="px-1 pt-1 text-xs text-muted-foreground">
            {t("+{{count}} autres — précisez la recherche", undefined, { count: reste })}
          </p>
        )}
      </>
    );
  };

  /* Ordre d'affichage UNIFIÉ : un groupe d'une famille (statique/scope/entity)
     peut s'intercaler parmi les groupes « par réponses » (et inversement) via
     `order`. Défaut : filterGroups (index) puis par-réponses (1000+index). Les
     éléments rendus sont triés par leur `key` (= id de groupe). */
  const groupOrder = new Map<string, number>();
  (filterGroups ?? []).forEach((g, i) => groupOrder.set(g.id, g.order ?? i));
  const answerGroupKeys = [...new Set([...Object.keys(filtersByAnswersOptions), ...Object.keys(filtersByPathOptions)])];
  answerGroupKeys.forEach((k, i) =>
    groupOrder.set(k, (filtersByPathOptions[k] ?? filtersByAnswersOptions[k])?.order ?? 1000 + i),
  );
  const sortByGroupOrder = (nodes: ReactNode[]) =>
    nodes
      .filter((n): n is ReactElement => !!n && typeof n === "object" && "key" in n)
      .sort((a, b) => (groupOrder.get(String(a.key)) ?? 999) - (groupOrder.get(String(b.key)) ?? 999));

  /* Corps (recherche + groupes) — UN SEUL rendu, affiché dans la sidebar
     desktop ET dans le Sheet mobile. */
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
      <div className="w-full">
        {sortByGroupOrder([
        ...(filterGroups ?? []).map((group) => {
          // Groupe alimenté par une query (zones / entités) encore en vol et
          // sans options : squelette en place (garde l'ordre, pas de pop-in).
          const queryEmpty = (group.options ?? []).length === 0;
          if (queryEmpty && group.type === "scopeList" && zoneResult.isLoading) {
            return renderGroupLoading(group.id, t(group.label), !!group.select);
          }
          if (queryEmpty && group.type === "entityList" && entityResult.isLoading) {
            return renderGroupLoading(group.id, t(group.label), !!group.select);
          }
          // Groupe `dateRange` : champ(s) date, sélection stockée sous la clé du
          // GROUPE dans searchByFields (une plage par groupe). La borne de fin
          // n'est proposée que si `withEnd` (support backend $lte requis).
          if (group.type === "dateRange") {
            const rangeField = group.field ?? "startDate";
            const current = (searchByFields[group.id]?.value ?? {}) as { start?: string; end?: string };
            const rangeCount = (current.start ? 1 : 0) + (current.end ? 1 : 0);
            return renderGroupCollapsible(
              group.id,
              <span className={cn("flex items-center gap-2 font-medium", rangeCount > 0 ? "text-primary" : "text-foreground")}>
                {t(group.label)}
                {rangeCount > 0 && <Badge className={COUNT_BADGE_CLASS}>{rangeCount}</Badge>}
              </span>,
              "space-y-2",
              <div className="space-y-2">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">{t("À partir du")}</Label>
                  <Input
                    type="date"
                    value={current.start ?? ""}
                    onChange={(e) => setRange(group.id, rangeField, { ...current, start: e.target.value })}
                  />
                </div>
                {group.withEnd && (
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">{t("Jusqu'au")}</Label>
                    <Input
                      type="date"
                      value={current.end ?? ""}
                      onChange={(e) => setRange(group.id, rangeField, { ...current, end: e.target.value })}
                    />
                  </div>
                )}
              </div>,
            );
          }
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
                dotColor={(option as { color?: string }).color}
                selected={isFilterSelected(group.id, filterName)}
                onToggle={() => {
                  if (group.type === "scopeList") {
                    toggleFilter(group.id, filterName, group.field ?? `${option.id}${option.level}`, filterName, option.level as ScopeLevel);
                  } else if (group.type === "entityList") {
                    // entityList → searchByFields (type sourceKey), à l'identique
                    // de computeFiltersFromUrl (chemin URL ?reseauxRegionaux=…).
                    // Sans ça le clic rangeait le réseau dans selectedFilters et
                    // le sourceKey n'était jamais envoyé à l'API.
                    const fType = group.filterType ?? "sourceKey";
                    toggleFilter(group.id, filterName, fType, filterName, null, fType);
                  } else if (group.type === "searchTargets") {
                    // Radio au sein du groupe : la cible (defaultTypes/defaultFilters)
                    // remplace celle de la section (cf. searchByFieldsToQuery).
                    toggleTarget(groupOptionNames, filterName, option.target ?? {});
                  } else if (group.field) {
                    // Groupe filtrant un CHAMP de l'entité (taxonomie en champs :
                    // parent62 `territoires`/`publics`/`themes`) → searchByFields
                    // → `{ champ: { $in: [...] } }` (cf. searchByFieldsToQuery).
                    // Sans `field`, le groupe filtre par TAG (comportement historique).
                    // `variants` : une option issue d'une source dynamique porte toutes les graphies
                    // regroupées derrière son libellé. Filtrer sur la seule graphie affichée laisserait
                    // de côté les fiches écrites autrement (« LE PORT » / « Le port » pour « Le Port »).
                    toggleFilter(group.id, filterName, group.field,
                      option.variants?.length ? option.variants : filterName);
                  } else {
                    toggleFilter(group.id, filterName);
                  }
                }}
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
              // searchTargets = radio : UN seul toggle, pas un diff add/remove.
              // `toggleTarget` efface le groupe puis coche l'option cliquée ;
              // itérer le diff [ajoutée, retirée] appellerait toggleTarget deux
              // fois → les deux s'annulent et on revient à l'option précédente.
              if (group.type === "searchTargets") {
                const applyTarget = (name: string) => {
                  const option = (group.options ?? []).find((o) => (o.name || o.id) === name);
                  toggleTarget(groupOptionNames, name, option?.target ?? {});
                };
                if (next.length > 0) {
                  // Sélectionne la nouvelle option (rien à faire si déjà active).
                  if (!current.includes(next[0])) applyTarget(next[0]);
                } else if (current.length > 0) {
                  // Select vidé → désélectionne l'option active.
                  applyTarget(current[0]);
                }
                return;
              }
              const changed = [
                ...next.filter((n) => !current.includes(n)),
                ...current.filter((c) => !next.includes(c)),
              ];
              for (const name of changed) {
                const option = (group.options ?? []).find((o) => (o.name || o.id) === name);
                if (group.type === "scopeList" && option) {
                  toggleFilter(group.id, name, group.field ?? `${option.id}${option.level}`, name, option.level as ScopeLevel);
                } else if (group.type === "entityList") {
                  const fType = group.filterType ?? "sourceKey";
                  toggleFilter(group.id, name, fType, name, null, fType);
                } else if (group.field) {
                  toggleFilter(group.id, name, group.field,
                    option?.variants?.length ? option.variants : name);
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
          return renderGroupCollapsible(
            group.id,
            <span className={cn("flex items-center gap-2 font-medium", isActive ? "text-primary" : "text-foreground")}>
              {t(group.label)}
              {isActive && <Badge className={COUNT_BADGE_CLASS}>{activeCount}</Badge>}
            </span>,
            group.optionStyle === "check" ? "space-y-0.5" : "space-y-2",
            groupByCountry && groupedOptions ? (
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
              renderOptionsCherchables(
                group.id,
                [...(group.options ?? [])].sort((a, b) => byLabel(t(a.label), t(b.label))),
                renderOption,
                (o) => isFilterSelected(group.id, o.name || o.id),
              )
            ),
          );
        }),
        // Groupes « par réponses » : on itère sur les clés de CONFIG (et non sur
        // les données du résultat) → ils gardent leur place et leur libellé
        // pendant le chargement CoForm (squelette) au lieu de surgir.
        ...answerGroupKeys.map((group) => {
          const groupData = filterAnswerData?.[group];
          const isPathGroup = group in filtersByPathOptions;
          const answerConf = isPathGroup ? filtersByPathOptions[group] : filtersByAnswersOptions[group];
          const answerLoading = isPathGroup ? filterByPathResult.isLoading : filterAnswerResult.isLoading;
          const answerOptionNames = groupData ? Object.keys(groupData.values) : [];
          // Cible du groupe : éléments liés (`_id`/orgaNameArray, défaut historique)
          // ou réponses elles-mêmes (prédicat de chemin) — cf. answerFilterClause.
          const toggleAnswerOption = (
            optionKey: string,
            option: { name?: string; orgaNameArray?: string[] },
          ) => {
            const { field, value, fieldType } = answerToggleArgs(
              answerConf as AnswerGroupConf | undefined,
              optionKey,
              option,
            );
            toggleFilter(group, optionKey, field, value, null, fieldType);
          };
          if (answerOptionNames.length === 0) {
            // pas (encore) d'options : squelette si la query tourne, sinon rien.
            return answerLoading
              ? renderGroupLoading(group, answerConf?.label ? t(answerConf.label) : group, !!answerConf?.select)
              : null;
          }
          if (!groupData) return null; // narrowing TS (options non vides ⇒ data présente)
          const answerActiveCount = getGroupActiveCount(group, answerOptionNames);
          const answerIsActive = answerActiveCount > 0;
          const headerLabel = (
            <span className={cn("flex items-center gap-2 font-medium", answerIsActive ? "text-primary" : "text-foreground")}>
              {t(groupData.label)}
              {answerIsActive && <Badge className={COUNT_BADGE_CLASS}>{answerActiveCount}</Badge>}
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
                toggleAnswerOption(name, groupData.values[name]);
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
                onClick={() => toggleAnswerOption(singleKey, singleValue)}
                className="h-auto w-full justify-between rounded-none border-b border-border py-3 text-sm font-normal hover:bg-muted"
              >
                {headerLabel}
              </Button>
            );
          }
          return renderGroupCollapsible(
            group,
            headerLabel,
            (filtersByAnswersOptions[group]?.optionStyle ?? filtersByPathOptions[group]?.optionStyle) === "check" ? "space-y-0.5" : "space-y-2",
            [...answerOptionNames]
              .sort((a, b) => byLabel(groupData.values[a].name, groupData.values[b].name))
              .map((optionKey) => {
                const option = groupData.values[optionKey];
                return (
                  <FilterOptionRow
                    key={optionKey}
                    label={capitalizeFirst(option.name)}
                    variant={filtersByAnswersOptions[group]?.optionStyle ?? filtersByPathOptions[group]?.optionStyle}
                    selected={isFilterSelected(group, optionKey)}
                    onToggle={() => toggleAnswerOption(optionKey, option)}
                  />
                );
              }),
          );
        }),
        ])}
      </div>
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
                <Badge className={cn("ml-2", COUNT_BADGE_CLASS)}>{totalActiveCount}</Badge>
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
                  <Badge className={COUNT_BADGE_CLASS}>{totalActiveCount}</Badge>
                )}
              </SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto px-4 pt-1">{body}</div>
            {/* Réinitialiser ancré en bas (zone pouce) — n'apparaît que s'il y a
                des filtres actifs ; pattern de la liste équipements. */}
            <SheetFooter className="flex-row gap-2 border-t border-border">
              {hasActiveFilters && (
                <Button variant="outline" className="flex-1" onClick={clearFilters}>
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
