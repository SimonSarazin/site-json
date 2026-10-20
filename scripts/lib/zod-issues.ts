import type { z } from "zod";

/** Une erreur prête à imprimer : chemin COMPLET depuis la racine du config + message du schéma. */
export interface FlatIssue {
  path: PropertyKey[];
  message: string;
  code: string;
}

/** Profondeur atteinte par une branche d'union : le chemin d'erreur le plus long qu'elle rapporte. */
function depth(branch: readonly z.core.$ZodIssue[]): number {
  return Math.max(0, ...branch.map((issue) => issue.path.length));
}

/**
 * Déplie les `invalid_union` de Zod 4 en erreurs lisibles.
 *
 * Une union dont TOUTES les branches échouent sur une erreur bloquante ne dit que « Invalid input » :
 * l'erreur utile vit dans `errors[branche]`, avec un chemin RELATIF à l'union. On garde la branche
 * allée le plus LOIN (chemin d'erreur le plus profond) — celle qui a reconnu l'objet : pour une
 * section admin builtin fautive (`rowActions: ["edite"]`), c'est son schéma builtin, pas le repli
 * « section costum » qui refuse le type à la racine. À égalité, toutes les branches ex æquo sont
 * imprimées : on ne devine pas. Une union sans branche détaillée (discriminant inconnu) reste telle
 * quelle.
 */
export function flattenIssues(issues: readonly z.core.$ZodIssue[], prefix: readonly PropertyKey[] = []): FlatIssue[] {
  return issues.flatMap((issue) => {
    const path = [...prefix, ...issue.path];
    if (issue.code !== "invalid_union" || issue.errors.length === 0) {
      return [{ path, message: issue.message, code: issue.code }];
    }
    const deepest = Math.max(...issue.errors.map(depth));
    return issue.errors.filter((branch) => depth(branch) === deepest).flatMap((branch) => flattenIssues(branch, path));
  });
}
