import { useCallback } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import { useSite } from "@/hooks/useSite";
import { costumCreateKey, type AddEntityType, type CostumFormRef } from "@/modules/profil/components/add/addModals";

/** Modale d'ajout d'un type : le form costum du site s'il y en a un seul (`costumCreateKey`), sinon `add-<type>`. */
export function useCostumAddModal(): (type: AddEntityType) => string {
  const { config: siteConfig } = useSite();
  const { entity } = useCocolight();
  const costumForms = (siteConfig as { costumForms?: Record<string, CostumFormRef> } | undefined)?.costumForms;
  const siteSlug = (entity as { slug?: string } | null)?.slug;
  return useCallback(
    (type: AddEntityType) => costumCreateKey(type, costumForms, siteSlug) ?? `add-${type}`,
    [costumForms, siteSlug],
  );
}
