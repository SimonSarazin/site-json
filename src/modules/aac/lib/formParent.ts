/**
 * Le CONTEXTE porteur d'un appel : la 1re entrée de `form.parent`.
 *
 * C'est sous cette clé que le backend AAP écrit et lit `choose[contextId]`, et
 * c'est l'entité de ce contexte qui détient l'enveloppe de financement des
 * réponses de cet appel (cf. `useCommunFundingHost`).
 *
 * Helper partagé — `aacConfigQuery` le résout pour l'appel du SITE, la fiche
 * d'un commun le résout pour l'appel d'ORIGINE d'un commun déposé ailleurs.
 * Deux lectures de la même donnée : une seule fonction, sinon elles dérivent.
 */

/** L'organisation (ou le projet) qui porte l'appel : sous elle s'écrit `choose`. */
export interface AacContext {
  id: string;
  type: string | null;
  name: string | null;
}

/**
 * @param formData - `form.serverData` (ou tout objet portant un `parent`).
 * @returns le contexte porteur, ou `null` si le form n'a pas de parent exploitable.
 */
export function firstParent(formData: unknown): AacContext | null {
  const parent = (formData as { parent?: unknown } | null)?.parent;
  if (!parent || typeof parent !== "object" || Array.isArray(parent)) return null;
  const [id, valeur] = Object.entries(parent as Record<string, unknown>)[0] ?? [];
  if (!id) return null;
  const infos = (valeur ?? {}) as { type?: unknown; name?: unknown };
  return {
    id,
    type: typeof infos.type === "string" ? infos.type : null,
    name: typeof infos.name === "string" ? infos.name : null,
  };
}
