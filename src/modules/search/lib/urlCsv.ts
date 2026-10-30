/**
 * Valeurs d'un paramètre d'URL en liste (`?groupe=a,b%2Cc`) : découpées sur la virgule puis DÉCODÉES par
 * segment — pendant de l'encodage à l'écriture (`computeUrlFromFilters.encodeValues`) : une valeur issue
 * d'une source dynamique peut contenir une virgule, qui couperait sinon la liste en deux. Segment
 * mal encodé : gardé tel quel. Paramètre absent : liste vide.
 */
export function decodeCsvParam(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((v) => {
      const t = v.trim();
      try {
        return decodeURIComponent(t);
      } catch {
        return t;
      }
    })
    .filter(Boolean);
}
