import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSite } from "@/hooks/useSite";
import { useT } from "@/hooks/useT";
import { getDropdownFilterOwner } from "@/modules/search/lib/dropdownFilters";
import { withFilterValueMaps } from "../dimensions";
import type { DimensionsConfig } from "../schema";

/**
 * Les dimensions de la config avec leur `valueMapFrom` résolu : la `valueMap` est tirée des options du
 * filtre déroulant désigné, cherché sur toutes les pages du site (`getDropdownFilterOwner`). Sans aucun
 * `valueMapFrom`, rend `dims` lui-même. Le résultat ne change qu'avec les dimensions, la config ou la
 * langue : les mémos en aval gardent leur référence d'un rendu à l'autre.
 */
export function useResolvedDimensions(dims: DimensionsConfig): DimensionsConfig {
  const { config } = useSite();
  const t = useT("modules/observatoire");
  const { i18n } = useTranslation();
  return useMemo(
    () => withFilterValueMaps(dims, (id) => getDropdownFilterOwner(config, id)?.filter.options, (l) => t(l)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` est recréé à chaque rendu (cf. useT) : la langue suffit.
    [dims, config, i18n.language],
  );
}
