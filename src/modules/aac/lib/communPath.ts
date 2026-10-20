/**
 * Chemin de la fiche d'un commun, utilisé par toutes les interfaces. La route reste littérale
 * dans `routes.tsx` (lue par analyse textuelle dans `scripts/lib/module-routes.ts`).
 */
export function communPath(answerId: string): string {
  return `/aac/commun/${answerId}`;
}
