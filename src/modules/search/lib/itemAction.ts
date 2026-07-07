/**
 * Résolution de l'URL d'une action `kind: "link"` (cf. `ListItemActionSchema`).
 *
 * Cas d'usage parent62 : dans la recherche globale, une actualité est un POI `type:"article"` dont
 * le clic doit mener au reader blog (`/blog/:slug`, ou `/blog/id/:id` pour les articles sans slug)
 * plutôt qu'ouvrir un drawer.
 */
import type { SearchEntity } from "@communecter/cocolight-api-client";
import type { ListItemAction, SearchListEntity } from "../schema";
import { getEntryId, getEntrySlug } from "./searchMapSelection";

/** Ce que produit un clic sur un item. `details` = ouvrir le détail (comportement historique). */
export type ItemClickDecision =
  | { kind: "link"; href: string; newTab: boolean }
  | { kind: "profil"; href: string }
  | { kind: "details" };

/**
 * Substitue `:slug` dans `to`, à défaut `:id` dans `toById`. Un gabarit SANS placeholder est un lien
 * statique, renvoyé tel quel.
 *
 * Renvoie `null` si aucun gabarit n'est exploitable — l'appelant NE doit alors pas naviguer
 * (garde contre une URL du type `/blog/id/undefined`).
 */
export function resolveItemLink(
  item: SearchListEntity | undefined,
  action: ListItemAction | undefined,
): string | null {
  if (!item || !action) return null;
  const entry = item as SearchEntity;

  if (action.to) {
    if (!action.to.includes(":slug")) return action.to;
    const slug = getEntrySlug(entry);
    if (slug) return action.to.replace(":slug", encodeURIComponent(slug));
  }
  if (action.toById) {
    if (!action.toById.includes(":id")) return action.toById;
    const id = getEntryId(entry);
    if (id) return action.toById.replace(":id", encodeURIComponent(id));
  }
  return null;
}

/**
 * Décision de clic — source UNIQUE partagée par la liste (`SearchListView`) et la popup de la carte
 * (`SearchMap`), qui appliquaient sinon deux fois la même cascade.
 *
 * Toute action inexploitable retombe sur `details` : un gabarit `link` sans slug ni id, un `profil`
 * sur un item sans slug. On ne navigue jamais vers une URL trouée (`/blog/id/undefined`).
 */
export function resolveItemClick(
  item: SearchListEntity | undefined,
  action: ListItemAction | undefined,
): ItemClickDecision {
  if (action?.kind === "link") {
    const href = resolveItemLink(item, action);
    if (href) return { kind: "link", href, newTab: Boolean(action.newTab) };
  } else if (action?.kind === "profil") {
    const slug = getEntrySlug(item as SearchEntity);
    if (slug) return { kind: "profil", href: `/profil/${slug}` };
  }
  return { kind: "details" };
}
