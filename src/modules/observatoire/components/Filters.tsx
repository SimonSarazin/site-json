import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { Filter, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { DimensionDef, DimensionsConfig, ObservatoryItem, FilterValues } from "../schema";
import {
  BOOL_FILTER_VALUES,
  dimensionList,
  dimensionValue,
} from "../dimensions";
import { uniqSorted } from "../utils";

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ id: string; label: string }>;
  /** Libellé « toutes valeurs » — toujours fourni par l'appelant (i18n). */
  allLabel: string;
}

/** Radix Select interdit `value=""` sur un item — sentinelle pour « Tous »
 *  (la valeur de filtre reste `""` côté formulaire/logique). */
const ALL_SENTINEL = "__all__";

function SelectField({ label, value, onChange, options, allLabel }: SelectFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Select
        value={value === "" ? ALL_SENTINEL : value}
        onValueChange={(v) => onChange(v === ALL_SENTINEL ? "" : v)}
      >
        <SelectTrigger className="w-full" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_SENTINEL}>{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
  /** Ids des dimensions filtrables, dans l'ordre d'affichage. */
  filterIds: readonly string[];
  /** Valeurs initiales (restauration depuis l'URL — permaliens). */
  values: FilterValues;
  onChange: (v: FilterValues) => void;
  /** Recherche texte (optionnelle — `props.search` de la section). */
  search?: FiltersSearchProps | null;
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
export function Filters({ data, dimensions, filterIds, values, onChange, search }: FiltersProps) {
  const t = useT("modules/observatoire");
  const [sheetOpen, setSheetOpen] = useState(false);

  // Les filtres déclarés mais sans dimension connue sont ignorés (warn DEV).
  const fields = useMemo(() => {
    const out: Array<{ id: string; def: DimensionDef }> = [];
    for (const id of filterIds) {
      const def = dimensions[id];
      if (def) out.push({ id, def });
      else if (import.meta.env.DEV) {
        console.warn(`[observatoire] filtre "${id}" sans dimension déclarée — ignoré`);
      }
    }
    return out;
  }, [filterIds, dimensions]);

  const { control, watch, reset } = useForm<FilterValues>({
    defaultValues: Object.fromEntries(
      fields.map(({ id }) => [id, values[id] ?? ""]),
    ),
  });
  const watched = watch();
  const valuesKey = JSON.stringify(watched);

  useEffect(() => {
    onChange(watched);
    // onChange est piloté par le parent (souvent recréé à chaque render)
    // — on ne déclenche qu'au changement effectif des valeurs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuesKey]);

  // Options par filtre : dérivées des données pour value/list, oui/non pour
  // anyTrue. Recalculées quand le dataset grossit (chargement progressif).
  const optionsById = useMemo(() => {
    const out: Record<string, Array<{ id: string; label: string }>> = {};
    for (const { id, def } of fields) {
      if (def.kind === "anyTrue") {
        out[id] = [
          { id: BOOL_FILTER_VALUES.TRUE, label: t("filters.yes") },
          { id: BOOL_FILTER_VALUES.FALSE, label: t("filters.no") },
        ];
      } else if (def.kind === "list") {
        out[id] = uniqSorted(data.flatMap((d) => dimensionList(d, def))).map(
          (v) => ({ id: v, label: v }),
        );
      } else {
        out[id] = uniqSorted(data.map((d) => dimensionValue(d, def))).map(
          (v) => ({ id: v, label: v }),
        );
      }
    }
    return out;
  }, [fields, data, t]);

  const labelFor = ({ id, def }: { id: string; def: DimensionDef }): string =>
    def.label ? t(def.label) : def.labelKey ? t(def.labelKey) : id;

  const activeCount = fields.filter(({ id }) => (watched[id] ?? "") !== "").length;

  const resetAll = () =>
    reset(Object.fromEntries(fields.map(({ id }) => [id, ""])));

  // Rendu d'un filtre — partagé entre la grille desktop et la Sheet mobile
  // (mêmes Controllers / même `control` : les deux restent synchronisés).
  const renderField = (field: { id: string; def: DimensionDef }) => (
    <Controller
      key={field.id}
      name={field.id}
      control={control}
      render={({ field: rhf }) => (
        <SelectField
          label={labelFor(field)}
          value={rhf.value ?? ""}
          onChange={rhf.onChange}
          options={optionsById[field.id] ?? []}
          allLabel={t("filters.all")}
        />
      )}
    />
  );

  return (
    <Card className="gap-0 rounded-2xl border-border/50 py-5">
      <CardContent className="px-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">{t("filters.title")}</h3>
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
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search.q}
              onChange={(e) => search.setQ(e.target.value)}
              placeholder={
                search.placeholder ? t(search.placeholder) : t("filters.search")
              }
              className="h-9 pl-9"
            />
          </div>
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
