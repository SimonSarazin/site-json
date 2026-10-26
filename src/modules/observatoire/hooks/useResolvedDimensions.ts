import { useMemo } from "react";
import { useSite } from "@/hooks/useSite";
import { useT } from "@/hooks/useT";
import { getDropdownFilterOwner } from "@/modules/search/lib/dropdownFilters";
import { withFilterValueMaps } from "../dimensions";
import type { DimensionsConfig } from "../schema";

/**
 * Les dimensions de la config avec leur `valueMapFrom` résolu : la `valueMap` est tirée des options du
 * filtre déroulant désigné, cherché sur toutes les pages du site (`getDropdownFilterOwner`). Sans aucun
 * `valueMapFrom`, rend `dims` lui-même.
 */
export function useResolvedDimensions(dims: DimensionsConfig): DimensionsConfig {
  const { config } = useSite();
  const t = useT("modules/observatoire");
  return useMemo(
    () => withFilterValueMaps(dims, (id) => getDropdownFilterOwner(config, id)?.filter.options, (l) => t(l)),
    [dims, config, t],
  );
}
