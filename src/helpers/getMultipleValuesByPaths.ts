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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMultipleValuesByPaths<T extends Record<string, string | undefined>>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: Record<string, any>,
  pathsMap: T,
  prefix?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): { [K in keyof T]: any } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = {} as { [K in keyof T]: any };

  for (const [key, fieldOrPath] of Object.entries(pathsMap)) {
    // Ignorer les valeurs undefined ou vides
    if (!fieldOrPath || fieldOrPath === '') {
      continue;
    }

    // Construire le chemin complet (avec préfixe si fourni)
    const fullPath = prefix ? `${prefix}.${fieldOrPath}` : fieldOrPath;

    // Parcourir le chemin
    const keys = fullPath.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value: any = obj;

    for (let i = 0; i < keys.length; i++) {
      if (value == null) {
        value = undefined;
        break;
      }
      value = value[keys[i]];
    }

    result[key as keyof T] = value;
  }

  return result;
}

export default getMultipleValuesByPaths;
