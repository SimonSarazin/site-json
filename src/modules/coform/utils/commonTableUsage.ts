/**
 * Règle de REGROUPEMENT des criterias d'un commonTable par usage.
 *
 * Extrait de `CommonTableField` (où elle vivait inline) pour être partagée avec
 * `categorizedCheckbox`, qui construit ses sous-options à partir du même catalogue : deux
 * implémentations de cette règle divergeraient tôt ou tard, et les deux écrans montreraient des
 * regroupements différents pour la même donnée.
 *
 * Le problème qu'elle résout : `usageKey` n'a été ajouté que tardivement au commonTable. Mesuré sur
 * la base de dev, il est ABSENT sur la grande majorité des entrées (8/10, 9/11, 14/19 selon la
 * question) — grouper dessus seul éclaterait un même besoin en autant de lignes que de répondants.
 * On retombe donc sur le texte de l'usage, normalisé.
 */

/** Source minimale : tout objet portant un usage et éventuellement sa clé. */
export interface UsageLike {
  usage?: string | null;
  usageKey?: string | null;
}

/**
 * Forme comparable d'un usage. Volontairement permissive (casse + espaces de bord seulement) :
 * c'est la règle historique du legacy `commonTableV2.php`. Deux libellés qui ne diffèrent que par
 * un accent ou une espace interne restent donc DEUX usages — limite connue et assumée.
 */
export function normalizeUsage(u: string | undefined | null): string {
  return String(u ?? "").trim().toLowerCase() || "sans usage";
}

/**
 * Construit le résolveur de clé de groupe à partir des sources disponibles, dans l'ordre de
 * priorité fourni (la première `usageKey` rencontrée pour un usage normalisé gagne).
 *
 * Résolution, pour un couple (usageKey, usage) :
 *   1. `usageKey` explicite → tel quel ;
 *   2. sinon, `usageKey` déjà connue pour ce même usage normalisé → on s'y aligne ;
 *   3. sinon, l'usage normalisé lui-même.
 *
 * L'étape 2 est ce qui recolle les entrées legacy (sans `usageKey`) sur les entrées récentes.
 */
export function buildUsageGroupKeyResolver(
  sources: Iterable<UsageLike>[],
): (usageKey: string | undefined | null, usage: string | undefined | null) => string {
  const usageKeyMap: Record<string, string> = {};
  for (const source of sources) {
    for (const entry of source) {
      if (!entry?.usageKey) continue;
      const norm = normalizeUsage(entry.usage);
      if (!usageKeyMap[norm]) usageKeyMap[norm] = entry.usageKey;
    }
  }
  return (rawUsageKey, rawUsage) => {
    if (rawUsageKey) return rawUsageKey;
    const norm = normalizeUsage(rawUsage);
    return usageKeyMap[norm] ?? norm;
  };
}
