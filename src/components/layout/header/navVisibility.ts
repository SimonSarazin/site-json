import type { VisibilityCondition } from "@/lib/visibility";

/** Ce dont ce module a besoin d'un item de nav — suffisant pour `NavItem` comme `EnhancedNavItem`. */
export interface NavNodeAvecVisibilite {
  visibility?: VisibilityCondition;
  children?: NavNodeAvecVisibilite[];
}

/**
 * Filtrage de `header.nav` par `item.visibility`, sur DEUX niveaux (l'item et ses `children`) —
 * utilisé par `HeaderMegaMenu`, dont le menu déroulant et le tiroir mobile partagent le même `nav`
 * (`HeaderStacked`/`HeaderTransparentScroll` ne filtrent que le niveau racine, via
 * `useVisibilityList`).
 *
 * Deux fonctions plutôt qu'une : `useVisibilityList` doit tourner en dehors d'un `.map()` (règle des
 * hooks), donc l'appelant aplatit d'abord les conditions à évaluer (`conditionsDeVisibiliteNav`),
 * passe le résultat au hook, puis reconstruit l'arbre filtré (`filtrerNavParVisibilite`) — les deux
 * DOIVENT parcourir `nav` dans le même ordre, d'où le partage du même helper des deux côtés.
 *
 * Un item masqué par SA PROPRE condition retire aussi ses enfants (`continue` sans les évaluer pour
 * l'affichage — ils restent comptés dans le flux pour garder les index alignés). Un item dont TOUS
 * les enfants sont masqués reste, lui, affiché s'il porte son propre `path` : « Les lieux » doit
 * rester cliquable même si « Mes lieux » est caché à un anonyme.
 */
export function conditionsDeVisibiliteNav<T extends NavNodeAvecVisibilite>(
  nav: readonly T[],
): (VisibilityCondition | undefined)[] {
  const conditions: (VisibilityCondition | undefined)[] = [];
  for (const item of nav) {
    conditions.push(item.visibility);
    for (const enfant of item.children ?? []) conditions.push(enfant.visibility);
  }
  return conditions;
}

/**
 * Reconstruit `nav` à partir des booléens rendus par `useVisibilityList(conditionsDeVisibiliteNav(nav))`
 * — mêmes tailles, même ordre. Un item sans `visibility` (et chaque enfant sans la sienne) reste
 * toujours affiché : `undefined` compte comme visible, comme le fait `useVisibility` lui-même.
 */
export function filtrerNavParVisibilite<T extends NavNodeAvecVisibilite>(
  nav: readonly T[],
  visibles: readonly boolean[],
): T[] {
  let curseur = 0;
  const resultat: T[] = [];
  for (const item of nav) {
    const itemVisible = visibles[curseur] ?? true;
    curseur += 1;
    const enfants = item.children ?? [];
    const enfantsVisibles: T[] = [];
    for (const enfant of enfants) {
      const enfantVisible = visibles[curseur] ?? true;
      curseur += 1;
      if (enfantVisible) enfantsVisibles.push(enfant as T);
    }
    if (!itemVisible) continue;
    resultat.push(enfants.length ? ({ ...item, children: enfantsVisibles } as T) : item);
  }
  return resultat;
}
