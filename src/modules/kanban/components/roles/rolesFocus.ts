/**
 * Reperage, dans le DOM, d'une colonne de role RENDUE et de la commande qui
 * recoit le focus quand une carte la quitte — le pendant de `cardFocus.ts`
 * pour le kanban des roles. Teste dans `tests/unit/rolesView.test.tsx`.
 */

/**
 * Colonne rendue d'un role. Par comparaison de `data-role-column` et non par
 * un selecteur construit : un libelle de role est une chaine libre, qu'il
 * faudrait echapper.
 */
export function roleColumnElementIn(root: ParentNode | null, role: string): HTMLElement | null {
  if (root === null) return null;
  for (const element of root.querySelectorAll<HTMLElement>('[data-role-column]')) {
    if (element.dataset.roleColumn === role) return element;
  }
  return null;
}

/**
 * Le menu « ⋯ » de l'en-tete d'une colonne de role : la seule commande de la
 * colonne qui survit au retrait de son dernier porteur. `null` si la colonne a
 * disparu (role supprime, ou colonne portee seulement : l'appelant se rabat
 * sur le titre de la vue).
 */
export function roleColumnMenuIn(root: ParentNode | null, role: string): HTMLElement | null {
  return roleColumnElementIn(root, role)?.querySelector<HTMLElement>('header button[aria-haspopup="menu"]') ?? null;
}

/**
 * Le menu « ⋯ » d'une carte de « Membres », par la cle du membre (`memberKey`). C'est la que
 * revient le focus quand la boite « Rôles… », ouverte depuis ce menu, se ferme : le menu Radix a
 * disparu avant que la boite ne s'ouvre, et la boite ne saurait pas ou rendre le focus. Par
 * comparaison de `data-member-card` et non par un selecteur construit, comme
 * `roleColumnElementIn`.
 */
export function memberMenuIn(root: ParentNode | null, key: string): HTMLElement | null {
  if (root === null) return null;
  for (const element of root.querySelectorAll<HTMLElement>('[data-member-card]')) {
    if (element.dataset.memberCard === key) return element.querySelector<HTMLElement>('button[aria-haspopup="menu"]');
  }
  return null;
}
