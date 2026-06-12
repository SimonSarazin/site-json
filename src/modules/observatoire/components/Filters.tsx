import { useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { Filter, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface FiltersProps {
  data: ObservatoryItem[];
  /** Dimensions déclarées par la config de section. */
  dimensions: DimensionsConfig;
  /** Ids des dimensions filtrables, dans l'ordre d'affichage. */
  filterIds: readonly string[];
  /** Valeurs initiales (restauration depuis l'URL — permaliens). */
  values: FilterValues;
  onChange: (v: FilterValues) => void;
}

/**
 * Barre de filtres DÉCLARATIVE : chaque filtre est une dimension
 * (`filterIds` × `dimensions`), les options sont DÉRIVÉES des données
 * chargées (pas de référentiel) — sauf les dimensions `anyTrue` (oui/non).
 * Libellés : `dimension.label` (config) > `dimension.labelKey` (i18n) > id.
 */
export function Filters({ data, dimensions, filterIds, values, onChange }: FiltersProps) {
  const t = useT("modules/observatoire");

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
            onClick={() =>
              reset(Object.fromEntries(fields.map(({ id }) => [id, ""])))
            }
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" /> {t("filters.reset")}
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 lg:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
          {fields.map((field) => (
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
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
