import { useMemo } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import { useSite } from "@/hooks/useSite";
import { ampliSourceMode, findAmpli, listAmplis, type AmpliSourceMode } from "../lib/costumAmpli";
import type { AmpliModel } from "../types";

/**
 * Les amplis du site, aiguillés sur `config.ampli` : `true` → `costum.ampli`
 * du porteur ; tableau → la forme historique de la config ; sinon aucun.
 *
 * `costum` est lu tel que l'entité le porte déjà (même lecture que `Seo.tsx`) :
 * `element/about` le renvoie au chargement du porteur, aucune requête ici.
 */
export function useAmplis(): { mode: AmpliSourceMode; amplis: AmpliModel[] } {
  const { config } = useSite();
  const { entity } = useCocolight();

  const ampliConfig: unknown = config.ampli;
  const costum: unknown = entity?.serverData?.costum;

  // Mémoïsé sur les deux sources : `listAmplis` re-parse chaque entrée, et la
  // liste part en dépendance des filtres et des compteurs de la page liste.
  const amplis = useMemo(() => listAmplis(ampliConfig, costum), [ampliConfig, costum]);

  return { mode: ampliSourceMode(ampliConfig), amplis };
}

/** L'ampli d'un slug, ou `null` (slug absent, inconnu, ou amplis désactivés). */
export function useAmpli(slug: string | undefined): AmpliModel | null {
  const { amplis } = useAmplis();
  return useMemo(() => (slug ? findAmpli(amplis, slug) : null), [amplis, slug]);
}
