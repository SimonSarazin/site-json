/**
 * Module du costum « structure » (Ekilib.re — Maison Sport Santé du Tampon) : la SEULE clé de code
 * irréductible du formulaire d'ajout de structure, tout le reste vivant en DONNÉES dans
 * `config.prod.maison-sport-sante-la-tampon.json` → `costumForms["structure"]`.
 *
 * Pourquoi une clé de code ici : le champ serveur `tags` (celui qu'interroge le filtre « Domaine
 * d'intervention » de la page /structure) porte des libellés COURTS, alors que `thematic` porte les
 * libellés LONGS saisis dans le formulaire. Les deux coexistent dans les données existantes. Un
 * transform de CHAMP ne reçoit pas de `params` (seuls les `serializeGroups` en ont, cf.
 * `fieldPipeline.valuesToPayload`) → la table de correspondance ne peut pas vivre dans le JSON.
 *
 * Aucun autre code : scope (slug du carrier), defaults (dérivés du descripteur), payload (pipeline
 * générique) et codecs (`address:*`, `social:*`, `geo:*`) sont tous des clés GÉNÉRIQUES déjà garanties
 * par `../sharedRegistrations`.
 */
import { registerTransform } from "@/modules/formEngine/engine/transforms";
import "../sharedRegistrations"; // side-effect : clés génériques (address/social/geo/coerce/invalidate…)

/**
 * `thematic` (libellé long, saisi) → `tags` (libellé court, indexé et filtré).
 * Table calée sur les données existantes du costum ET sur les `options` du filtre `domaine-structure`
 * de la page /structure — les deux doivent rester alignés. Les valeurs absentes de cette table sont
 * identiques des deux côtés (Sport, Santé/prévention, Social, Insertion, Culture, Tourisme, Handicap)
 * et passent donc par l'identité.
 *
 * ⚠ « Periscolaire » est SANS accent côté `tags` (et « 2eme » y est écrit en toutes lettres) alors que
 * `thematic` porte « Périscolaire »/« 2nd » : ce n'est pas une coquille, c'est la forme réellement
 * stockée et celle que les options du filtre comparent.
 */
const THEMATIC_TO_TAG: Record<string, string> = {
  "Scolaire 1er degré - Maternelle et primaire": "Scolaire 1er degré",
  "Scolaire 2nd degré - Collège et Lycée": "Scolaire 2nd degré",
  "Périscolaire 1er degré - Maternelle et primaire": "Periscolaire 1er degré",
  "Périscolaire 2nd degré - Collège et Lycée": "Periscolaire 2eme degré",
};

/** Projette une liste de `thematic` en `tags` (dédoublonnée, ordre d'entrée préservé). */
export function thematicToTags(thematic: unknown): string[] {
  if (!Array.isArray(thematic)) return [];
  const out = thematic
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .map((v) => THEMATIC_TO_TAG[v] ?? v);
  return [...new Set(out)];
}

/**
 * Le DOMAINE des tags dérivables de `thematic` : les formes courtes de la table + les valeurs
 * identité (mêmes libellés des deux côtés, cf. commentaire de THEMATIC_TO_TAG). C'est le périmètre
 * que l'édition a le droit de réécrire — tout tag HORS domaine (ex. le marqueur « mss » des
 * Maisons Sport-Santé, porté par 20/180 orgs réelles du costum) est un tag ÉTRANGER à préserver.
 */
const TAG_DOMAIN = new Set<string>([
  ...Object.values(THEMATIC_TO_TAG),
  "Sport", "Santé/prévention", "Social", "Insertion", "Culture", "Tourisme", "Handicap",
]);

/**
 * WRITE du champ `tags` : MERGE fidèle au legacy — `sportSanteBienetre_index.js:118-190` ne retire
 * que les valeurs du domaine décochées et ne touche JAMAIS les tags étrangers. L'ancienne version
 * REMPLAÇAIT `tags` par la seule projection de `thematic` : un simple ouvrir-sauver effaçait
 * « mss » et tout tag hors domaine. Le champ n'est plus `writeOnly` : sa valeur COURANTE est
 * seedée depuis l'entité (`v`), la fusion = (courants ∖ DOMAINE) ∪ projection(thematic), ordre
 * préservé, dédoublonnée. `undefined` (clé omise) seulement quand il n'y a NI courant NI
 * projection ; sinon un résultat vide est émis tel quel — décocher toutes les thématiques retire
 * bien les tags du domaine, sans jamais toucher aux étrangers.
 */
registerTransform("structure:tagsFromThematic", (v, all) => {
  const current = Array.isArray(v) ? v.filter((t): t is string => typeof t === "string") : [];
  const projected = thematicToTags((all as Record<string, unknown>)?.thematic);
  if (current.length === 0 && projected.length === 0) return undefined;
  return [...new Set([...current.filter((t) => !TAG_DOMAIN.has(t)), ...projected])];
});

// NB : le contournement `number:fromDigits` (siren/téléphones coercés en NOMBRE tronqué — perte du
// 0 initial et du « + ») a été SUPPRIMÉ : sa prémisse était fausse. L'artefact costum livré déclare
// ces trois champs en `oneOf string|number` (vérifié dans la lib publiée) — les CHAÎNES passent
// l'AJV telles quelles, et la politique du repo est le stockage string byte-fidèle (la base est
// 100 % chaînes, ex. « 0692 88 33 19 »). Les champs redeviennent du texte brut.
