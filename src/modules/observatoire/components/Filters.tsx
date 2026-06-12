import { useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { Filter, RotateCcw } from "lucide-react";
import { useT } from "@/hooks/useT";
import type { Equipment, FilterValues } from "../schema";
import { EMPTY_FILTERS } from "../schema";
import { PMR_FILTER_VALUES } from "../constants/queryKeys";
import {
  getCommune,
  getEpci,
  getNature,
  getPropType,
  getType,
  normalizeAps,
  uniqSorted,
} from "../utils";

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  allLabel?: string;
  optionLabels?: Record<string, string>;
}

function SelectField({ label, value, onChange, options, allLabel = "Tous", optionLabels }: SelectFieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {optionLabels?.[o] ?? o}
          </option>
        ))}
      </select>
    </label>
  );
}

interface FiltersProps {
  data: Equipment[];
  onChange: (v: FilterValues) => void;
}

export function Filters({ data, onChange }: FiltersProps) {
  const t = useT("modules/observatoire");
  const { control, watch, reset } = useForm<FilterValues>({
    defaultValues: EMPTY_FILTERS,
  });
  const values = watch();
  const valuesKey = JSON.stringify(values);

  useEffect(() => {
    onChange(values);
    // onChange est piloté par le parent (souvent recréé à chaque render)
    // — on ne déclenche qu'au changement effectif des valeurs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuesKey]);

  const opts = useMemo(
    () => ({
      commune: uniqSorted(data.map(getCommune)),
      type: uniqSorted(data.map(getType)),
      epci: uniqSorted(data.map(getEpci)),
      nature: uniqSorted(data.map(getNature)),
      prop: uniqSorted(data.map(getPropType)),
      aps: uniqSorted(data.flatMap((d) => normalizeAps(d.aps_name))),
    }),
    [data],
  );

  return (
    <div className="rounded-2xl bg-card p-5 shadow-sm border border-border/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">{t("filters.title")}</h3>
        </div>
        <button
          type="button"
          onClick={() => reset(EMPTY_FILTERS)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="h-3 w-3" /> {t("filters.reset")}
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        <Controller
          name="commune"
          control={control}
          render={({ field }) => (
            <SelectField
              label={t("filters.commune")}
              value={field.value}
              onChange={field.onChange}
              options={opts.commune}
              allLabel={t("filters.all")}
            />
          )}
        />
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <SelectField
              label={t("filters.type")}
              value={field.value}
              onChange={field.onChange}
              options={opts.type}
              allLabel={t("filters.all")}
            />
          )}
        />
        <Controller
          name="epci"
          control={control}
          render={({ field }) => (
            <SelectField
              label={t("filters.epci")}
              value={field.value}
              onChange={field.onChange}
              options={opts.epci}
              allLabel={t("filters.all")}
            />
          )}
        />
        <Controller
          name="nature"
          control={control}
          render={({ field }) => (
            <SelectField
              label={t("filters.nature")}
              value={field.value}
              onChange={field.onChange}
              options={opts.nature}
              allLabel={t("filters.all")}
            />
          )}
        />
        <Controller
          name="pmr"
          control={control}
          render={({ field }) => (
            <SelectField
              label={t("filters.pmr")}
              value={field.value}
              onChange={field.onChange}
              options={[PMR_FILTER_VALUES.ACCESSIBLE, PMR_FILTER_VALUES.NOT_ACCESSIBLE]}
              optionLabels={{
                [PMR_FILTER_VALUES.ACCESSIBLE]: t("filters.pmrAccessible"),
                [PMR_FILTER_VALUES.NOT_ACCESSIBLE]: t("filters.pmrNotAccessible"),
              }}
              allLabel={t("filters.all")}
            />
          )}
        />
        <Controller
          name="prop"
          control={control}
          render={({ field }) => (
            <SelectField
              label={t("filters.owner")}
              value={field.value}
              onChange={field.onChange}
              options={opts.prop}
              allLabel={t("filters.all")}
            />
          )}
        />
        <Controller
          name="aps"
          control={control}
          render={({ field }) => (
            <SelectField
              label={t("filters.sport")}
              value={field.value}
              onChange={field.onChange}
              options={opts.aps}
              allLabel={t("filters.all")}
            />
          )}
        />
      </div>
    </div>
  );
}
