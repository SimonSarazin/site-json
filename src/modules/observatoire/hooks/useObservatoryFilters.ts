import { useMemo, useState } from "react";
import type { Equipment, FilterValues } from "../schema";
import { EMPTY_FILTERS } from "../schema";
import { PMR_FILTER_VALUES } from "../constants/queryKeys";
import {
  getCommune,
  getEpci,
  getNature,
  getPropType,
  getType,
  isPmrAccessible,
  normalizeAps,
} from "../utils";

function applyFilters(data: Equipment[], f: FilterValues): Equipment[] {
  return data.filter((d) => {
    if (f.commune && getCommune(d) !== f.commune) return false;
    if (f.type && getType(d) !== f.type) return false;
    if (f.epci && getEpci(d) !== f.epci) return false;
    if (f.nature && getNature(d) !== f.nature) return false;
    if (f.prop && getPropType(d) !== f.prop) return false;
    if (f.pmr) {
      const pmr = isPmrAccessible(d);
      if (f.pmr === PMR_FILTER_VALUES.ACCESSIBLE && !pmr) return false;
      if (f.pmr === PMR_FILTER_VALUES.NOT_ACCESSIBLE && pmr) return false;
    }
    if (f.aps) {
      const list = normalizeAps(d.aps_name);
      if (!list.includes(f.aps)) return false;
    }
    return true;
  });
}

export function useObservatoryFilters(equipments: Equipment[]) {
  const [filters, setFilters] = useState<FilterValues>(EMPTY_FILTERS);

  const filtered = useMemo(
    () => applyFilters(equipments, filters),
    [equipments, filters],
  );

  return { filters, setFilters, filtered };
}
