/**
 * PORTE DE VALIDATION costum — module PARTAGÉ.
 *
 * POURQUOI un module à part : cette porte vivait, privée, dans `buildSearchPayload` — donc elle ne
 * servait que les surfaces passant par `searchCostum` via ce chemin. Les trois surfaces qui ne
 * l'empruntent pas ont chacune découvert son absence PAR UN BUG :
 *  - la section `agenda` appelle `searchEventsCostum` avec son propre builder (commit e3f1a060 :
 *    « un événement déposé via un formulaire costum aurait été publié immédiatement ») ;
 *  - la palette ⌘K appelle `searchCostum` en direct (même commit : « une fiche en attente était
 *    atteignable par la palette sur les 14 pages alors qu'elle n'apparaît dans aucune liste ») ;
 *  - `data-observatory` jetait `costumSlug` dans sa liste blanche de baseParams.
 * Chaque fois, le correctif a été de réécrire les deux clauses À LA MAIN dans la config du site —
 * du périmètre de sécurité recopié, que rien ne garde synchronisé. La fonction est ici pour être
 * APPELÉE, pas recopiée.
 */

/**
 * Collections « élément » où le flag de validation costum (`toBeValidated`) a un sens. Les news
 * (`scope`/`target`), `answers`/`proposals` (survey) ont un modèle de visibilité distinct → jamais gatées.
 * Inclut les sous-types d'organisation (NGO/LocalBusiness/…), qui sont des éléments à part entière.
 */
const VALIDATABLE_TYPES = new Set<string>([
  "poi", "organizations", "projects", "events", "citoyens",
  "NGO", "LocalBusiness", "Group", "GovernmentOrganization", "Cooperative",
]);

/** PHP-truthy sur `notSourceKey` (peut valoir 0/1, "0"/"1", ou bool). */
export function isTruthy(v: unknown): boolean {
  return !!v && v !== "0" && v !== 0;
}

/**
 * Porte côté client le filtre de VALIDATION du legacy (SearchNew::getQueries:783-818), pour les
 * searches PUBLIQUES scopées costum : masque les éléments EN ATTENTE de validation via le **double
 * flag** `preferences.toBeValidated.<slug>` ET `source.toBeValidated.<slug>` (les deux voies legacy).
 *
 * Pourquoi côté client : le backend Node `buildQuery` est STATELESS (ne pose jamais `toBeValidated`),
 * et le legacy 5080 ne le pose que si le cache costum est chaud (non déterministe). Un filtre client
 * explicite rend le comportement déterministe sur les deux backends.
 *
 * ACTIF dès qu'un `costumSlug` est fourni ; NON appliqué si :
 *  - `showUnvalidated` (opt-out, miroir du `showTobevaledated` legacy),
 *  - `variant === 'admin'` (l'admin gère la validation par son `statusFilter`),
 *  - `notSourceKey` (réseau-wide : pas de costum de scope → pas de slug à indexer),
 *  - types explicitement hors collections « élément » (news/answers : visibilité par `scope`, route dédiée).
 *
 * IDEMPOTENTE : les clés écrites sont déterministes pour un slug donné, donc l'appliquer sur des
 * `filters` qui les portent déjà (config ayant recopié la garde à la main) ne change rien.
 *
 * Divergence ASSUMÉE vs legacy : PAS de branche `author-sees-own` (creator==me). Le client est
 * stateless (comme le backend Node) → un fil public montre les validés uniquement. Cf doc/19-visibility-system.md (Visibilité des données).
 */
export function applyValidationGate(
  filters: Record<string, unknown> | undefined,
  opts: { costumSlug?: unknown; notSourceKey?: unknown; types?: string[]; showUnvalidated?: boolean; variant?: string },
): Record<string, unknown> | undefined {
  const { costumSlug, notSourceKey, types, showUnvalidated, variant } = opts;
  if (showUnvalidated || variant === "admin") return filters;
  if (typeof costumSlug !== "string" || !costumSlug) return filters;
  if (isTruthy(notSourceKey)) return filters;
  if (types && types.length > 0 && !types.every((t) => VALIDATABLE_TYPES.has(t))) return filters;
  return {
    ...(filters ?? {}),
    [`preferences.toBeValidated.${costumSlug}`]: { $exists: false },
    [`source.toBeValidated.${costumSlug}`]: { $exists: false },
  };
}
