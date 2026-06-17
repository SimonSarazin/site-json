import { useEffect, useMemo, useRef, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useForm, Controller } from "react-hook-form";
import { Filter, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useT } from "@/hooks/useT";
import type { DimensionDef, DimensionsConfig, FilterDef, ObservatoryItem, FilterValues } from "../schema";
import {
  BOOL_FILTER_VALUES,
  dimensionList,
  dimensionValue,
  isBoolKind,
  type LabelMaps,
} from "../dimensions";
import { uniqSorted } from "../utils";
import {
  SelectField,
  MultiCheckboxField,
  MultiField,
} from "@/modules/search/components/filterFields";

/**
 * Input de recherche ISOLÉ : la valeur immédiate (chaque frappe) vit ici —
 * seule cette boîte re-rend pendant la saisie. La valeur DÉBOUNCÉE (250 ms)
 * remonte au hook (filtrage + URL). Sans cette isolation, chaque frappe
 * re-rendait toute la section, 5 charts recharts compris.
 */
function SearchInput({ q, setQ, placeholder }: { q: string; setQ: (v: string) => void; placeholder: string }) {
  const [value, setValue] = useState(q);
  const debounced = useDebounce(value, 250);

  useEffect(() => {
    if (debounced !== q) setQ(debounced);
    // setQ vient du hook parent (stable via useCallback) ; q sert de garde
    // anti-écho, pas de déclencheur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Resynchronisation externe (reset section, navigation) : si le parent
  // change q hors saisie, l'input suit.
  useEffect(() => {
    setValue((current) => (q !== current && q !== debounced ? q : current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="relative mb-3">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-9 pl-9"
      />
    </div>
  );
}

interface FiltersSearchProps {
  q: string;
  setQ: (v: string) => void;
  /** Placeholder localisé (config) — sinon i18n du module. */
  placeholder?: Record<string, string>;
}

interface FiltersProps {
  data: ObservatoryItem[];
  /** Dimensions déclarées par la config de section. */
  dimensions: DimensionsConfig;
  /** Filtres déclarés (id simple ou {dimension, multiple, searchable}). */
  filterDefs: readonly FilterDef[];
  /** Valeurs initiales (restauration depuis l'URL — permaliens). */
  values: FilterValues;
  onChange: (v: FilterValues) => void;
  /** Recherche texte (optionnelle — `props.search` de la section). */
  search?: FiltersSearchProps | null;
  /** Chargement en cours : {loaded, total} → badge « données partielles ». */
  partial?: { loaded: number; total: number | null } | null;
  /** Libellés canoniques (dimensions à `keyPaths`) — options de filtre regroupées. */
  labels?: LabelMaps;
}

/**
 * Barre de filtres DÉCLARATIVE : chaque filtre est une dimension
 * (`filterIds` × `dimensions`), les options sont DÉRIVÉES des données
 * chargées (pas de référentiel) — sauf les dimensions `anyTrue` (oui/non).
 * Libellés : `dimension.label` (config) > `dimension.labelKey` (i18n) > id.
 *
 * Mobile : un seul bouton « Filtres » (badge compteur actif) → Sheet bas —
 * même pattern que le `searchHeader` du module search. La recherche texte
 * (optionnelle) reste visible sur tous les écrans.
 */
export function Filters({ data, dimensions, filterDefs, values, onChange, search, partial, labels }: FiltersProps) {
  const t = useT("modules/observatoire");
  const [sheetOpen, setSheetOpen] = useState(false);

  // Les filtres déclarés mais sans dimension connue sont ignorés (warn DEV).
  const fields = useMemo(() => {
    const out: Array<{ id: string; def: DimensionDef; filter: FilterDef }> = [];
    for (const filter of filterDefs) {
      const def = dimensions[filter.dimension];
      if (def) out.push({ id: filter.dimension, def, filter });
      else if (import.meta.env.DEV) {
        console.warn(`[observatoire] filtre "${filter.dimension}" sans dimension déclarée — ignoré`);
      }
    }
    return out;
  }, [filterDefs, dimensions]);

  const { control, watch, reset, setValue } = useForm<FilterValues>({
    defaultValues: Object.fromEntries(
      fields.map(({ id }) => [id, values[id] ?? ""]),
    ),
  });
  const watched = watch();
  const valuesKey = JSON.stringify(watched);

  // Clé restreinte aux SEULES valeurs des dimensions parentes (`dependsOn`). Les
  // options ne dépendent des sélections QUE via la cascade → recalculer `optionsById`
  // sur tout changement de filtre serait du gaspillage (O(nb_filtres × n) à chaque
  // clic). On ne déclenche le recalcul que sur changement d'un PARENT (ou de `data`).
  const cascadeParentKey = JSON.stringify(
    Object.fromEntries(
      [...new Set(fields.map((f) => f.filter.dependsOn).filter((p): p is string => !!p))]
        .map((pid) => [pid, watched[pid] ?? ""]),
    ),
  );

  // Resynchronisation DESCENDANTE : si le parent change les filtres HORS du
  // formulaire (drill-down sur un graphe, bouton reset de l'état vide), on
  // aligne RHF — sinon les selects continuent d'afficher l'ancien état.
  // Le ref évite que le push montant re-déclenche un onChange d'écho.
  const externalKey = JSON.stringify(
    Object.fromEntries(fields.map(({ id }) => [id, values[id] ?? ""])),
  );
  const syncingDown = useRef(false);
  useEffect(() => {
    if (externalKey === valuesKey) return;
    syncingDown.current = true;
    reset(JSON.parse(externalKey) as FilterValues);
    // valuesKey est volontairement hors deps : on ne resynchronise que sur
    // changement EXTERNE (sinon chaque saisie locale déclencherait un reset).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalKey, reset]);

  useEffect(() => {
    if (syncingDown.current) {
      syncingDown.current = false;
      return;
    }
    onChange(watched);
    // onChange est piloté par le parent (souvent recréé à chaque render)
    // — on ne déclenche qu'au changement effectif des valeurs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuesKey]);

  // Options par filtre : dérivées des données pour value/list, oui/non pour
  // anyTrue. Recalculées quand le dataset grossit (chargement progressif).
  // Cascade (opt-in via `dependsOn`) : si un filtre déclare une dimension
  // parente ET que celle-ci a une valeur sélectionnée, les options sont
  // restreintes aux items dont la dimension parente correspond.
  const optionsById = useMemo(() => {
    const out: Record<string, Array<{ id: string; label: string }>> = {};
    for (const { id, def, filter } of fields) {
      let sourceData = data;
      if (filter.dependsOn) {
        const parentVal = (watched[filter.dependsOn] ?? "") as string;
        if (parentVal !== "") {
          const parentDef = dimensions[filter.dependsOn];
          if (parentDef) {
            const selected = parentVal.split(",").map((s) => s.trim()).filter(Boolean);
            sourceData = data.filter((item) => {
              const v = dimensionValue(item, parentDef, labels?.[filter.dependsOn!]);
              return v !== undefined && selected.includes(v);
            });
          }
        }
      }
      if (isBoolKind(def.kind)) {
        out[id] = [
          { id: BOOL_FILTER_VALUES.TRUE, label: t("filters.yes") },
          { id: BOOL_FILTER_VALUES.FALSE, label: t("filters.no") },
        ];
      } else if (def.kind === "list") {
        out[id] = uniqSorted(sourceData.flatMap((d) => dimensionList(d, def))).map(
          (v) => ({ id: v, label: v }),
        );
      } else {
        const raw = uniqSorted(
          sourceData.map((d) => dimensionValue(d, def, labels?.[id])).filter((v): v is string => v !== undefined),
        ).map((v) => ({ id: v, label: v }));
        // `values` comme allowlist : restreint les options aux valeurs déclarées
        // (ex. dimension `epci` qui normalise des codes postaux → noms EPCI via
        // valueMap — sans allowlist, les codes sans mapping s'afficheraient bruts).
        out[id] = def.values?.length ? raw.filter((opt) => def.values!.includes(opt.id)) : raw;
      }
    }
    return out;
    // cascadeParentKey (valeurs des parents `dependsOn` seulement) : recalcul
    // uniquement sur changement de parent — pas sur chaque clic de filtre. `watched`
    // est lu dans le corps mais hors deps (capturé via cascadeParentKey).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, data, cascadeParentKey, t, labels, dimensions]);

  // Réconciliation cascade : quand un parent (`dependsOn`) change, les options de
  // l'enfant se restreignent — on ÉLAGUE alors les valeurs sélectionnées devenues
  // invalides (sinon elles restent appliquées en « fantôme », non retirables dans
  // le MultiCombobox qui ne rend que les options). Converge en 1 cycle (après
  // élagage tout est valide), `setValue` propage la remontée onChange.
  useEffect(() => {
    for (const { id, filter } of fields) {
      if (!filter.dependsOn) continue;
      const current = (watched[id] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      if (current.length === 0) continue;
      const valid = new Set((optionsById[id] ?? []).map((o) => o.id));
      const pruned = current.filter((v) => valid.has(v));
      if (pruned.length !== current.length) {
        setValue(id, pruned.join(","));
      }
    }
    // Déclenché par le changement des options (= changement parent). `watched`/
    // `setValue` volontairement hors deps (lus au moment de l'exécution).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsById]);

  const labelFor = ({ id, def }: { id: string; def: DimensionDef }): string =>
    def.label ? t(def.label) : def.labelKey ? t(def.labelKey) : id;

  const activeCount = fields.filter(({ id }) => (watched[id] ?? "") !== "").length;

  const resetAll = () =>
    reset(Object.fromEntries(fields.map(({ id }) => [id, ""])));

  // Rendu d'un filtre — partagé entre la grille desktop et la Sheet mobile
  // (mêmes Controllers / même `control` : les deux restent synchronisés).
  // Dispatch (matrice multiple × searchable) :
  //   multiple+searchable → MultipleSelector · multiple seul → DropdownMenu
  //   checkboxes (pattern equipements) · searchable seul → MultipleSelector
  //   limité à 1 (le choix remplace) · sinon Select simple.
  // Les dimensions anyTrue (oui/non) restent toujours en Select simple.
  const renderField = (field: { id: string; def: DimensionDef; filter: FilterDef }) => {
    const isBool = isBoolKind(field.def.kind);
    const common = {
      label: labelFor(field),
      options: optionsById[field.id] ?? [],
      allLabel: t("filters.all"),
    };
    return (
      <Controller
        key={field.id}
        name={field.id}
        control={control}
        render={({ field: rhf }) =>
          !isBool && field.filter.searchable ? (
            <MultiField
              {...common}
              value={rhf.value ?? ""}
              onChange={rhf.onChange}
              noResult={t("filters.noResult")}
              single={!field.filter.multiple}
            />
          ) : !isBool && field.filter.multiple ? (
            <MultiCheckboxField
              {...common}
              value={rhf.value ?? ""}
              onChange={rhf.onChange}
              selectedCountLabel={(n) => t("filters.selectedCount", undefined, { count: n })}
            />
          ) : (
            <SelectField {...common} value={rhf.value ?? ""} onChange={rhf.onChange} />
          )
        }
      />
    );
  };

  return (
    <Card className="gap-0 rounded-2xl border-border/50 py-5">
      <CardContent className="px-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">{t("filters.title")}</h3>
            {/* Indicateur de filtres ACTIFS — même signal que le trigger
                mobile (badge compteur), visible aussi en desktop. */}
            {activeCount > 0 && (
              <Badge className="hidden rounded-full px-2 lg:inline-flex">{activeCount}</Badge>
            )}
            {/* Filtrer pendant le chargement est PERMIS (la page 1 SSR est là
                dès le 1er paint) — mais l'état partiel doit être lisible. */}
            {partial && (
              <Badge variant="outline" className="gap-1 rounded-full text-xs font-normal text-muted-foreground">
                <Spinner className="size-2.5" />
                {t("filters.partialData", undefined, {
                  loaded: partial.loaded,
                  total: partial.total ?? "…",
                })}
              </Badge>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetAll}
            className="hidden h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground lg:inline-flex"
          >
            <RotateCcw className="h-3 w-3" /> {t("filters.reset")}
          </Button>
        </div>

        {/* Recherche texte (optionnelle) — visible sur tous les écrans. */}
        {search && (
          <SearchInput
            q={search.q}
            setQ={search.setQ}
            placeholder={search.placeholder ? t(search.placeholder) : t("filters.search")}
          />
        )}

        {fields.length > 0 && (
          <>
            {/* Desktop : filtres inline en grille auto-fit. */}
            <div className="hidden gap-3 lg:grid lg:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
              {fields.map(renderField)}
            </div>

            {/* Mobile : bouton « Filtres » (compteur actif) → Sheet bas —
                pattern du searchHeader. */}
            <div className="lg:hidden">
              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-11 w-full justify-between rounded-xl px-3"
                  >
                    <span className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4" />
                      {t("filters.title")}
                    </span>
                    {activeCount > 0 && (
                      <Badge className="ml-2 rounded-full px-2">{activeCount}</Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="max-h-[85vh] gap-0 rounded-t-2xl p-0">
                  <SheetHeader className="border-b border-border">
                    <SheetTitle className="flex items-center gap-2">
                      <SlidersHorizontal className="h-5 w-5 text-primary" />
                      {t("filters.title")}
                      {activeCount > 0 && (
                        <Badge className="rounded-full px-2">{activeCount}</Badge>
                      )}
                    </SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-3 overflow-y-auto p-4">
                    {fields.map(renderField)}
                  </div>
                  <SheetFooter className="flex-row gap-2 border-t border-border">
                    {activeCount > 0 && (
                      <Button variant="ghost" className="flex-1" onClick={resetAll}>
                        {t("filters.reset")}
                      </Button>
                    )}
                    <SheetClose asChild>
                      <Button className="flex-1">{t("filters.showResults")}</Button>
                    </SheetClose>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
