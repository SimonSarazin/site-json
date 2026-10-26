import { useMemo } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import { useSite } from "@/hooks/useSite";
import {
  ampliSourceMode,
  costumAmpliSlugs,
  findAmpli,
  listAmplis,
  type AmpliSourceMode,
} from "../lib/costumAmpli";
import type { AmpliModel } from "../types";

export interface AmplisOfSite {
  mode: AmpliSourceMode;
  amplis: AmpliModel[];
  /**
   * Identifiants DÉJÀ PRIS dans `costum.ampli` — clés et slugs déclarés, lus sur
   * la donnée brute. Sert la garde anti-collision de la création : le serveur
   * écrase une entrée de même clé sans prévenir, y compris une entrée qu'on ne
   * sait pas afficher.
   */
  takenSlugs: string[];
}

/**
 * Les amplis du site : `costum.ampli` du porteur quand `config.ampli` vaut
 * `true`, rien sinon.
 *
 * `costum` est lu tel que l'entité le porte déjà (même lecture que `Seo.tsx`) :
 * `element/about` le renvoie au chargement du porteur, aucune requête ici.
 */
export function useAmplis(): AmplisOfSite {
  const { config } = useSite();
  const { entity } = useCocolight();

  const ampliConfig: unknown = config.ampli;
  const costum: unknown = entity?.serverData?.costum;
  const mode = ampliSourceMode(ampliConfig);

  // Mémoïsé sur les deux sources : `listAmplis` re-parse chaque entrée, et la
  // liste part en dépendance des filtres et des compteurs de la page liste.
  const amplis = useMemo(() => listAmplis(ampliConfig, costum), [ampliConfig, costum]);
  const takenSlugs = useMemo(
    () => (mode === "costum" ? costumAmpliSlugs(costum) : []),
    [mode, costum],
  );

  return { mode, amplis, takenSlugs };
}

/** L'ampli d'un slug, ou `null` (slug absent, inconnu, ou amplis désactivés). */
export function useAmpli(slug: string | undefined): AmpliModel | null {
  const { amplis } = useAmplis();
  return useMemo(() => (slug ? findAmpli(amplis, slug) : null), [amplis, slug]);
}
