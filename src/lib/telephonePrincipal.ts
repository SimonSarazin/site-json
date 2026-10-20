/**
 * Téléphone principal d'une fiche (`serverData`), pour l'affichage et le pré-remplissage d'édition.
 *
 * Le `mobile` PLAT passe en premier : c'est la clé qu'écrivent les formulaires structure SSBE et
 * Ekilib.re (seule clé déclarée par leur costum), alors que le backend ne met pas à jour `telephone`
 * lors d'un enregistrement complet. Quand les deux coexistent, `telephone.mobile` est donc la valeur
 * d'AVANT la dernière édition (mesuré le 24/09 : 8 fiches SSBE sur 149, souvent sans le 0 initial).
 * Repli sur `telephone` (chaîne, ou objet `{ mobile: [...], fixe: [...] }`), puis `phone`.
 */
export function telephonePrincipal(sd: Record<string, unknown> | null | undefined): string | undefined {
  const plat = premierNumero(sd?.mobile);
  if (plat) return plat;
  const brut = sd?.telephone ?? sd?.phone;
  if (brut && typeof brut === "object" && !Array.isArray(brut)) {
    const t = brut as { mobile?: unknown; fixe?: unknown };
    return premierNumero(t.mobile) ?? premierNumero(t.fixe);
  }
  return premierNumero(brut);
}

/** Premier numéro non vide d'une valeur scalaire ou d'une liste (le backend stocke aussi des nombres). */
function premierNumero(v: unknown): string | undefined {
  for (const x of Array.isArray(v) ? v : [v]) {
    if (typeof x === "number") return String(x);
    if (typeof x === "string" && x.trim() !== "") return x.trim();
  }
  return undefined;
}
