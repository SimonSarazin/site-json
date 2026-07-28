/**
 * Hook de résolution du type de cagnotte.
 *
 * Résout la valeur finale du `cagnotteType`
 *
 * Retourne : { type, config }
 *  - `type` = valeur finale
 *  - `config` = CagnotteTypeConfig correspondante (et toutes ses settings)
 *
 * Consommation :
 * ```tsx
 * const { type, config } = useCagnotteType({
 *   propsOverride: cagnotteType, // from CagnotteDialog props
 *   config: props?.cagnotteType, // from site-schema
 * });
 *
 */

import { useMemo } from "react"; import type { CagnotteType, CagnotteTypeConfig } from "../types";
import { CAGNOTTE_TYPE_CONFIGS } from "../types";
import { DEFAULT_CAGNOTTE_TYPE } from "../types";

export interface UseCagnotteTypeParams {
    propsOverride?: CagnotteType;
    siteConfig?: CagnotteType;
}

export interface UseCagnotteTypeResult {
    type: CagnotteType;
    config: CagnotteTypeConfig;
}

export function useCagnotteType( params: UseCagnotteTypeParams ): UseCagnotteTypeResult {
    const siteGlobalCagnotteType = params?.siteConfig;
    return useMemo(() => {
        const resolvedType: CagnotteType =
            params.propsOverride ??
            siteGlobalCagnotteType ??
            DEFAULT_CAGNOTTE_TYPE;

        let config = CAGNOTTE_TYPE_CONFIGS[resolvedType];
        return { type: resolvedType, config };
    }, [params.propsOverride, siteGlobalCagnotteType]);
}