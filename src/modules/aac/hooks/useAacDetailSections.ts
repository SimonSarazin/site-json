/**
 * Les blocs de prose de la fiche d'un commun, résolus depuis `config.aac.detail`.
 *
 * Aucune requête supplémentaire : `useAacFormMeta` lit la même entrée de cache que
 * le reste du module (`aacConfigQuery`), par un `select` différent — même principe
 * que `useAacDirectoryContext`.
 */
import { useMemo } from "react";
import { useSite } from "@/hooks/useSite";
import { useT } from "@/hooks/useT";
import type { LocalizedString } from "@/types/locale-schema";
import { placeKindSourceKeys } from "@/modules/coform/utils/finderFilters";
import { useAacFormMeta } from "./useAacFormMeta";
import {
  resolveAacDetailSections,
  type AacDetailSection,
} from "../lib/resolveAacDetailSections";

interface UseAacDetailSectionsResult {
  sections: AacDetailSection[];
  /**
   * Vrai tant que les métadonnées du formulaire sont en vol. Sans lui, les blocs
   * déclarés — et leurs entrées de sommaire — sont d'abord absents puis surgissent.
   */
  isLoading: boolean;
}

export function useAacDetailSections(formId: string | null): UseAacDetailSectionsResult {
  const { config: siteConfig } = useSite();
  const { meta, isLoading } = useAacFormMeta(formId);
  const t = useT("modules/aac");

  const declared = siteConfig.aac?.detail?.sections;

  const sections = useMemo(
    // `t` traduit les `LocalizedString` de la config ; il est injecté dans la
    // fonction pure plutôt qu'importé par elle, pour la garder testable hors i18n.
    () => resolveAacDetailSections(meta, declared, (v) => (v ? String(t(v as LocalizedString)) : "")),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` est recréé à chaque rendu (cf. useT) : l'inclure annulerait le mémo.
    [meta, declared]
  );

  return { sections, isLoading };
}

/** Le `subKey` des documents de la galerie, déclaré par le site. */
export function useAacGallerySubKey(): string | null {
  const { config: siteConfig } = useSite();
  return siteConfig.aac?.detail?.gallery ?? null;
}

/** Le form d'usage dont le finder partagé filtre « J'utilise » (`config.aac.detail.usageFormId`). */
export function useAacUsageFormId(): string | null {
  const { config: siteConfig } = useSite();
  return siteConfig.aac?.detail?.usageFormId ?? null;
}

/**
 * Le périmètre des lieux de « J'utilise » : `config.aac.detail.placeSourceKeys`
 * s'il est déclaré, sinon le préréglage de `config.aac.detail.placeKind`
 * (défaut : tiers-lieux). Même résolution que `PlacesListView`.
 */
export function useAacPlaceSourceKeys(): string[] {
  const { config: siteConfig } = useSite();
  const placeKind = siteConfig.aac?.detail?.placeKind;
  const override = siteConfig.aac?.detail?.placeSourceKeys;
  return useMemo(() => placeKindSourceKeys(placeKind, override), [placeKind, override]);
}
