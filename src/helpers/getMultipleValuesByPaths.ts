/**
 * Extrait plusieurs valeurs d'un objet en utilisant des chemins en notation pointée en une seule passe.
 * Plus efficace que d'appeler getValueByPath plusieurs fois.
 *
 * @param obj - L'objet source à parcourir
 * @param pathsMap - Un objet mappant des clés vers des chemins en notation pointée ou des noms de champs
 * @param prefix - Préfixe optionnel à ajouter devant chaque chemin (ex: "answers")
 * @returns Un objet avec les mêmes clés que pathsMap, contenant les valeurs extraites
 *
 * @example
 * // Utilisation avec des chemins complets
 * const data = { answers: { name: "John", age: 30, tags: ["dev"] } };
 * const result1 = getMultipleValuesByPaths(data, {
 *   name: "answers.name",
 *   age: "answers.age",
 *   tags: "answers.tags"
 * });
 * // Retourne: { name: "John", age: 30, tags: ["dev"] }
 *
 * @example
 * // Utilisation avec préfixe (filtrage automatique des valeurs undefined/vides)
 * const dataPath = { name: "projectName", description: "projectDesc", tags: "" };
 * const result2 = getMultipleValuesByPaths(data, dataPath, "answers");
 * // Construit automatiquement "answers.projectName", "answers.projectDesc"
 * // Ignore le champ vide "tags"
 */
function getMultipleValuesByPaths<T extends Record<string, string | undefined>>(
  obj: Record<string, unknown>,
  pathsMap: T,
  prefix?: string
): { [K in keyof T]: unknown } {
  const result = {} as { [K in keyof T]: unknown };

  for (const [key, fieldOrPath] of Object.entries(pathsMap)) {
    // Ignorer les valeurs undefined ou vides
    if (!fieldOrPath || fieldOrPath === '') {
      continue;
    }

    // Construire le chemin complet (avec préfixe si fourni)
    const fullPath = prefix ? `${prefix}.${fieldOrPath}` : fieldOrPath;

    // Parcourir le chemin
    const keys = fullPath.split('.');
    let value: unknown = obj;

    for (let i = 0; i < keys.length; i++) {
      if (value == null) {
        value = undefined;
        break;
      }
      value = (value as Record<string, unknown>)[keys[i]];
    }

    result[key as keyof T] = value;
  }

  return result;
}

export default getMultipleValuesByPaths;
