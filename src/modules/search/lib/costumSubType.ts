/**
 * SOUS-TYPES de costum — résolution des forms d'une collection et expansion de `costumSubType`.
 *
 * Une entité appartient au sous-type S du costum C si elle est NATIVE (créée par le form : elle
 * matche son `identity`) ou ANNOTÉE (`reference.costumTypes.C == S`, posé au référencement). Le
 * discriminant vit UNE fois, dans la déclaration du form (`costumForms.<id>.identity`) ; tout le
 * reste — pages, onglets admin, sélecteur de référencement — pivote sur la clé `subType`.
 *
 * CONTRAINTE SERVEUR, mesurée dans les deux backends : la grammaire `$or` des filtres ne porte que
 * des clauses MONO-CHAMP (le legacy construit `array($champ => $valeur)` par entrée —
 * `SearchNew::searchFilters` ; la forme tableau y produirait un champ « 0 »). Deux conséquences :
 *  • la branche native du `$or` est l'`identity` SEULE — le périmètre costum (`source.keys` OU
 *    `reference.costum`) est déjà appliqué en `$and` au-dessus par le serveur (`buildSourceKey`),
 *    donc aucune fuite hors costum ; le seul recouvrement possible est une entité référencée dont
 *    le champ natif coïncide avec un AUTRE sous-type du même costum — rare et assumé ;
 *  • une `identity` multi-champs n'est pas exprimable côté serveur : on prend le premier champ et
 *    on avertit. (Côté client — routes `editModals` — la grammaire complète reste disponible.)
 */

/** Sous-ensemble utile d'un document `config.costumForms` pour la résolution de sous-type. */
export interface CostumFormSubTypeLike {
  id?: string;
  entityType?: string;
  costumSlug?: string;
  subType?: string;
  subTypeLabel?: unknown;
  identity?: Record<string, unknown>;
}

type CostumFormsMap = Record<string, CostumFormSubTypeLike | undefined> | null | undefined;

/** Chemin de l'annotation posée au référencement (miroir : useReferenceElement, editModals). */
export const cheminAnnotation = (slug: string): string => `reference.costumTypes.${slug}`;

/**
 * Les forms d'une collection, costum du site prioritaire quand plusieurs le déclarent — même règle
 * que la création `inherit` (`resolveCreateModal` côté admin, `costumCreateKey` côté profil).
 */
export function formsDeCollection(
  costumForms: CostumFormsMap,
  collection: string,
  siteSlug: string | null | undefined,
): CostumFormSubTypeLike[] {
  const tous = Object.entries(costumForms ?? {})
    .map(([cle, doc]) => ({ id: doc?.id ?? cle, ...doc }))
    .filter((d) => d.entityType === collection);
  const duSite = tous.filter((d) => siteSlug && d.costumSlug === siteSlug);
  return duSite.length > 0 ? duSite : tous;
}

/** Le form portant ce `subType` (dans le périmètre du site), ou null. */
export function formDeSousType(
  costumForms: CostumFormsMap,
  subType: string,
  siteSlug: string | null | undefined,
): CostumFormSubTypeLike | null {
  for (const [, doc] of Object.entries(costumForms ?? {})) {
    if (!doc || doc.subType !== subType) continue;
    if (siteSlug && doc.costumSlug && doc.costumSlug !== siteSlug) continue;
    return doc;
  }
  return null;
}

/**
 * Expanse `baseParams.costumSubType` en la disjonction canonique, dans `defaultFilters.$or` (forme
 * OBJET — la seule que le legacy accepte) :
 *
 *   `$or { <champ identity>: <valeur>, "reference.costumTypes.<slug>": <subType> }`
 *
 * Sans `costumSubType`, les baseParams ressortent inchangés (même référence). Un `$or` déjà déclaré
 * en forme objet est fusionné ; en forme tableau il est laissé tel quel et l'expansion est ignorée
 * (mélanger les deux serait ambigu — avertissement console).
 */
export function expandCostumSubType<T extends { costumSubType?: string; defaultFilters?: Record<string, unknown> }>(
  baseParams: T | undefined,
  costumForms: CostumFormsMap,
  siteSlug: string | null | undefined,
): T | undefined {
  const subType = baseParams?.costumSubType;
  if (!baseParams || !subType || !siteSlug) return baseParams;

  const { costumSubType: _ignore, ...reste } = baseParams;
  const filtres = { ...(baseParams.defaultFilters ?? {}) };
  const orExistant = filtres.$or;
  if (Array.isArray(orExistant)) {
    console.warn(`[costumSubType] ${subType} : $or déjà déclaré en forme tableau — expansion ignorée`);
    return baseParams;
  }

  const branches: Record<string, unknown> = { ...(orExistant as Record<string, unknown> | undefined ?? {}) };
  const form = formDeSousType(costumForms, subType, siteSlug);
  const identite = Object.entries(form?.identity ?? {});
  if (identite.length > 0) {
    // Mono-champ pour le serveur (cf. en-tête) ; multi-champs → premier champ + avertissement.
    if (identite.length > 1) {
      console.warn(`[costumSubType] ${subType} : identity multi-champs — seule la première clause part au serveur`);
    }
    const [champ, valeur] = identite[0];
    branches[champ] = valeur;
  } else if (!form) {
    console.warn(`[costumSubType] aucun form ne déclare subType "${subType}" — branche annotation seule`);
  }
  // Form par défaut (identity absente) : la branche native n'est pas exprimable positivement — la
  // branche annotation reste la seule ; les natifs du form par défaut relèvent d'un filtre manuel.
  branches[cheminAnnotation(siteSlug)] = subType;

  return { ...reste, defaultFilters: { ...filtres, $or: branches } } as unknown as T;
}
