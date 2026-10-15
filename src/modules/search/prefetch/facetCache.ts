/**
 * Cache SERVEUR des facettes de filtres — le mémo de `prefetchFilters`.
 *
 * Les facettes (zones pays/régions, listes d'entités des `filterGroups`, filtres par réponses,
 * filtres par thématique) sont redemandées au backend à CHAQUE rendu SSR d'une page de recherche,
 * alors qu'elles sont identiques pour tous les visiteurs (le SSR est anonyme) et changent rarement.
 * Mesuré sur tiers-lieux `/lieux` : les deux appels de facettes thématiques
 * (`autoglobalthematicntwrk`) pèsent 2,2 s cumulées sur une page servie en 2 s.
 *
 * Avec ce mémo, un conteneur ne refait chaque appel de facette qu'une fois par durée de vie ; entre
 * deux, le rendu lit la copie en mémoire. Les RÉSULTATS de recherche ne passent pas par ici : ils
 * restent frais à chaque rendu. Côté client, rien ne change (`useSearchZoneQuery` & co. parlent au
 * backend directement après hydratation).
 *
 * Réglage : `SSR_FACET_CACHE_TTL_MS` (serveur uniquement ; défaut 5 min ; `0` désactive). La clé de
 * chaque entrée est la queryKey React Query de la facette, déjà une sérialisation déterministe de
 * ses paramètres.
 */
import { createSsrMemo } from "@/lib/ssrMemo";

export const SSR_FACET_CACHE_TTL_ENV = "SSR_FACET_CACHE_TTL_MS";
export const SSR_FACET_CACHE_TTL_DEFAULT_MS = 5 * 60_000;

/** Lit la durée de vie dans l'environnement du PROCESSUS serveur (pas `window.__ENV__`). */
export function facetCacheTtlMs(env: Record<string, string | undefined> = processEnv()): number {
  const raw = env[SSR_FACET_CACHE_TTL_ENV];
  if (raw === undefined || raw.trim() === "") return SSR_FACET_CACHE_TTL_DEFAULT_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : SSR_FACET_CACHE_TTL_DEFAULT_MS;
}

function processEnv(): Record<string, string | undefined> {
  return typeof process !== "undefined" && process.env ? process.env : {};
}

export const facetCache = createSsrMemo({ ttlMs: facetCacheTtlMs() });
