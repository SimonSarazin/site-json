/**
 * `unknown` → `string[]` : un tableau filtré à ses strings non vides, une string seule → `[string]`,
 * sinon `[]`. Mutualise le `asArray`/`toArray` dupliqué (lecture de champs costum multi-valeurs sur
 * `serverData` : territoires/publics/ages/themes/tags…). cf. cartographie-fonctions.
 */
export const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : typeof value === "string" && value.trim()
      ? [value.trim()]
      : [];
