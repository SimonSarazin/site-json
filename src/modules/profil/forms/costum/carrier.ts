/**
 * Forme MINIMALE d'une entité PORTEUSE de costum (le « carrier » = `useCocolight().entity`) dont les `scope`
 * fns ont besoin : `id` + un `slug` dans `serverData`. Contrat étroit, pur et testable, PARTAGÉ par les costums.
 *
 * `serverData` est volontairement `unknown` (pas `{ slug?: string }`) : l'union SDK `EntityTypes` a des
 * `serverData` HÉTÉROGÈNES (ex. `News` → `NewsItemNormalized`), incompatibles avec une forme `{ slug? }` (règle
 * "weak type" de TS). On accepte donc n'importe quel carrier et on extrait le slug par narrowing DANS
 * `carrierSlug` — un seul cast localisé, au lieu d'un `as` à chaque site d'appel.
 */
export type CarrierLike = { id?: string | null; serverData?: unknown } | null | undefined;

/** Slug du carrier, trimé ; "" si absent / non-string / vide. (`EntityTypes` est assignable à `CarrierLike`.) */
export function carrierSlug(carrier: CarrierLike): string {
  const sd = carrier?.serverData;
  const slug = sd && typeof sd === "object" ? (sd as { slug?: unknown }).slug : undefined;
  return typeof slug === "string" ? slug.trim() : "";
}
