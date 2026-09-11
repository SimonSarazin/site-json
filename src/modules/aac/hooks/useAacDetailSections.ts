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
import { useAacFormMeta } from "./useAacFormMeta";
import {
  resolveAacDetailSections,
  type AacDetailSection,
} from "../lib/resolveAacDetailSections";

export function useAacDetailSections(formId: string | null): AacDetailSection[] {
  const { config: siteConfig } = useSite();
  const { meta } = useAacFormMeta(formId);
  const t = useT("modules/aac");

  const declared = siteConfig.aac?.detail?.sections;

  return useMemo(
    // `t` traduit les `LocalizedString` de la config ; il est injecté dans la
    // fonction pure plutôt qu'importé par elle, pour la garder testable hors i18n.
    () => resolveAacDetailSections(meta, declared, (v) => (v ? String(t(v as LocalizedString)) : "")),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` est recréé à chaque rendu (cf. useT) : l'inclure annulerait le mémo.
    [meta, declared]
  );
}

/** Le `subKey` des documents de la galerie, déclaré par le site. */
export function useAacGallerySubKey(): string | null {
  const { config: siteConfig } = useSite();
  return siteConfig.aac?.detail?.gallery ?? null;
}
