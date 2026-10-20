import { classifyHref } from "@/lib/linkKind";

/**
 * Clic dans une section `html` : faut-il naviguer en SPA, ou laisser le navigateur faire ?
 *
 * Le HTML d'une section vient de la config, donc ses liens sont des `<a href>` bruts — un clic
 * RECHARGE la page, là où le même lien dans le menu passe par React Router. La section délègue donc
 * le clic à cette décision, PURE (aucun hook, aucun `window`) et donc testable seule.
 *
 * Ce qui reste au navigateur, et pourquoi : les gestes d'ouverture parallèle (clic milieu, Ctrl/Cmd,
 * Maj, Alt) — les intercepter casserait « ouvrir dans un nouvel onglet » ; `target` et `download`,
 * qui demandent explicitement autre chose ; les ancres `#`, les `mailto:`/`tel:` et l'externe, que
 * `classifyHref` sépare déjà pour tout le parc (`NavLink`, `CTASection`, `CardsSection`).
 */
export interface ClicDansHtml {
  /** `href` de l'ancre cliquée — `null` si le clic n'était pas sur un lien. */
  href: string | null | undefined;
  /** Attribut `target` de l'ancre (`_blank`, `_self`…). */
  target?: string | null;
  /** L'ancre porte `download`. */
  download?: boolean;
  /** Clic du bouton principal (`event.button === 0`). */
  boutonPrincipal: boolean;
  /** Une touche de modification était enfoncée (Ctrl/Cmd/Maj/Alt). */
  avecModificateur: boolean;
  /** Un autre handler a déjà traité l'événement (`event.defaultPrevented`). */
  dejaTraite?: boolean;
}

/** Destination à passer à `navigate()`, ou `null` quand le navigateur doit garder la main. */
export function destinationSpa(clic: ClicDansHtml): string | null {
  if (clic.dejaTraite || !clic.boutonPrincipal || clic.avecModificateur) return null;
  if (clic.download) return null;
  if (clic.target && clic.target !== "_self") return null;
  if (classifyHref(clic.href) !== "internal") return null;
  return clic.href ?? null;
}
