/**
 * `unknown` → `string[]` : un tableau filtré à ses strings non vides, une string seule → `[string]`,
 * un OBJET → ses valeurs ou ses clés (voir ci-dessous), sinon `[]`. Mutualise le `asArray`/`toArray`
 * dupliqué (lecture de champs costum multi-valeurs sur `serverData` : territoires/publics/ages/themes/
 * tags…). cf. cartographie-fonctions.
 *
 * Le legacy renvoie parfois un champ multi-valeurs en OBJET :
 *  - tableau PHP à index non contigus après un `unset` (`{"0": "a", "2": "b"}`) → les VALEURS sont les
 *    éléments — reconnu à ses clés, toutes des index entiers ;
 *  - dictionnaire de présence (`{"a": true}`, ou `{"a": "true"}` après un POST form-urlencoded) → les
 *    CLÉS sont les éléments.
 * Un rendu qui itère `.map` sur ces formes plante ; tout lecteur de `tags` passe donc par ici.
 */
export const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter(estTexte);
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (value && typeof value === "object") {
    const cles = Object.keys(value as Record<string, unknown>);
    const tableauPhp = cles.length > 0 && cles.every((k) => /^\d+$/.test(k));
    return (tableauPhp ? Object.values(value as Record<string, unknown>) : cles).filter(estTexte);
  }
  return [];
};

const estTexte = (x: unknown): x is string => typeof x === "string" && x.trim().length > 0;
