import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router";
import { usePageFiltersOptional } from "../contexts/pageFilters";
import type { InstallationFilterConf } from "../schema";
import {
  activeValues,
  fromParam,
  nextValues,
  toParam,
  toSearchByFields,
} from "../lib/installationFilter";

const DEFAULT_PARAM = "poi-installation";
const DEFAULT_GROUP_KEY = "inst_numero";

function resolve(conf: InstallationFilterConf | undefined) {
  return {
    param: conf?.param ?? DEFAULT_PARAM,
    field: conf?.groupKey ?? DEFAULT_GROUP_KEY,
  };
}

/**
 * Filtre « installation » déclenché depuis une carte : lecture de la sélection
 * + toggle (état `PageFilters` + miroir URL en UNE mutation).
 *
 * L'état est la source, l'URL son miroir — même contrat que les dropdowns du
 * header. Hors Provider (`enabled: false`), la valeur reste du texte simple.
 */
export function useInstallationFilter(conf: InstallationFilterConf | undefined) {
  const pageFilters = usePageFiltersOptional();
  const [, setSearchParams] = useSearchParams();
  const { param, field } = resolve(conf);

  const searchByFields = pageFilters?.searchByFields;
  const active = useMemo(
    () => activeValues(searchByFields ?? {}, param),
    [searchByFields, param],
  );

  const setSearchByFields = pageFilters?.setSearchByFields;
  const toggle = useCallback(
    (value: string) => {
      if (!setSearchByFields) return;
      const next = nextValues(active, value);
      // Réécriture complète des clés du param : évite toute dérive entre l'état
      // et le miroir URL (les deux partent du même `next`).
      setSearchByFields((prev) => {
        const prefix = `${param}:`;
        const cleaned = Object.fromEntries(
          Object.entries(prev).filter(([key]) => !key.startsWith(prefix)),
        );
        return { ...cleaned, ...toSearchByFields(param, field, next) };
      });
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          toParam(params, param, next);
          return params;
        },
        { replace: true, preventScrollReset: true },
      );
    },
    [setSearchByFields, setSearchParams, active, param, field],
  );

  return {
    enabled: Boolean(conf && setSearchByFields),
    isActive: useCallback((value: string) => active.includes(value), [active]),
    toggle,
  };
}

/**
 * Hydratation au MONTAGE : restaure le filtre depuis l'URL → contexte, comme
 * `SearchHeaderSection` pour ses dropdowns. One-time (ref garde) : ensuite le
 * contexte est la source et l'URL son miroir. Rend les liens partagés opérants.
 *
 * À monter UNE SEULE FOIS par page (côté section), jamais dans la carte.
 */
export function useInstallationFilterUrlSync(conf: InstallationFilterConf | undefined): void {
  const pageFilters = usePageFiltersOptional();
  const [searchParams] = useSearchParams();
  const setSearchByFields = pageFilters?.setSearchByFields;
  const { param, field } = resolve(conf);

  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || !conf || !setSearchByFields) return;
    hydratedRef.current = true;
    const values = fromParam(searchParams.get(param));
    if (!values.length) return;
    setSearchByFields((prev) => ({ ...prev, ...toSearchByFields(param, field, values) }));
    // Montage uniquement — restauration initiale depuis l'URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
