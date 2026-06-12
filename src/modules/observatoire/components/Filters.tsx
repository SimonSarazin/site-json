import { useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { Filter, RotateCcw } from "lucide-react";
import type { Equipment, FilterValues } from "../schema";
import { EMPTY_FILTERS } from "../schema";
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
}

function SelectField({ label, value, onChange, options }: SelectFieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <option value="">Tous</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
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
          <h3 className="text-sm font-semibold">Filtres</h3>
        </div>
        <button
          type="button"
          onClick={() => reset(EMPTY_FILTERS)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="h-3 w-3" /> Réinitialiser
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        <Controller
          name="commune"
          control={control}
          render={({ field }) => (
            <SelectField
              label="Commune"
              value={field.value}
              onChange={field.onChange}
              options={opts.commune}
            />
          )}
        />
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <SelectField
              label="Type"
              value={field.value}
              onChange={field.onChange}
              options={opts.type}
            />
          )}
        />
        <Controller
          name="epci"
          control={control}
          render={({ field }) => (
            <SelectField
              label="EPCI"
              value={field.value}
              onChange={field.onChange}
              options={opts.epci}
            />
          )}
        />
        <Controller
          name="nature"
          control={control}
          render={({ field }) => (
            <SelectField
              label="Nature"
              value={field.value}
              onChange={field.onChange}
              options={opts.nature}
            />
          )}
        />
        <Controller
          name="pmr"
          control={control}
          render={({ field }) => (
            <SelectField
              label="PMR"
              value={field.value}
              onChange={field.onChange}
              options={["Accessible", "Non accessible"]}
            />
          )}
        />
        <Controller
          name="prop"
          control={control}
          render={({ field }) => (
            <SelectField
              label="Propriétaire"
              value={field.value}
              onChange={field.onChange}
              options={opts.prop}
            />
          )}
        />
        <Controller
          name="aps"
          control={control}
          render={({ field }) => (
            <SelectField
              label="Sport pratiqué"
              value={field.value}
              onChange={field.onChange}
              options={opts.aps}
            />
          )}
        />
      </div>
    </div>
  );
}
