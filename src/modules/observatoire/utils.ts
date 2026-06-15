// Agrégations génériques du module observatoire. AUCUN accesseur métier :
// la lecture des champs passe par le moteur de dimensions (./dimensions.ts),
// déclarées dans la config de section.

/** Comptage générique par clé. */
export function countBy<T>(
  arr: T[],
  fn: (t: T) => string | undefined,
): Array<{ name: string; value: number }> {
  const m = new Map<string, number>();
  for (const x of arr) {
    const k = fn(x);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
}

/** Liste triée et dédupliquée des valeurs non vides. */
export function uniqSorted(values: Array<string | undefined>): string[] {
  const set = new Set<string>();
  for (const v of values) {
    if (typeof v === "string" && v.trim() !== "") set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
}
