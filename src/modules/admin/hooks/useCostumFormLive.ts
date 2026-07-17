import { useQuery } from "@tanstack/react-query";

import { descriptorToConfig } from "@/modules/formEngine/config/costumToConfig";
import { useCocolight } from "@/hooks/useCocolight";

import { ADMIN_QUERY_KEYS } from "../constants/queryKeys";

import type { JsonFormConfig } from "@/modules/formEngine/config/schema";

/**
 * Voie B RUNTIME (RFC doc/31 fil C / F5-C3) : dérive une `JsonFormConfig` de formulaire costum EN LIVE
 * depuis la lib — `me.costum(slug).describeForm(collection)` (CostumFormDescriptor) → `descriptorToConfig`.
 *
 * Utilité : un costum SANS entrée `config.costumForms` (et, avec la lib ≥ 1.0.164, même HORS du registre
 * bundlé grâce à `getcostumjson` — F4/C1) obtient quand même un formulaire d'ajout/édition portant ses
 * champs, sans re-publier la lib ni écrire de config. Renvoie `null` si le costum ne couvre pas la
 * collection (→ l'appelant retombe sur le form standard).
 *
 * NB : le plein effet HORS registre exige la lib 1.0.164 (describeForm live). Avec 1.0.163, ne couvre
 * que les costums bundlés.
 */
export function useCostumFormLive(
  slug: string | undefined,
  collection: string,
): { config: JsonFormConfig | null; isLoading: boolean } {
  const { me } = useCocolight();
  const q = useQuery({
    queryKey: ADMIN_QUERY_KEYS.COSTUM_FORM_LIVE(slug ?? "", collection),
    enabled: !!me && !!slug,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<JsonFormConfig | null> => {
      const scope = await (me as unknown as { costum: (s: string) => Promise<{ describeForm: (c: string) => unknown }> }).costum(slug!);
      const desc = scope.describeForm(collection);
      if (!desc) return null;
      return descriptorToConfig(desc as Parameters<typeof descriptorToConfig>[0]) ?? null;
    },
  });
  return { config: q.data ?? null, isLoading: q.isLoading };
}
