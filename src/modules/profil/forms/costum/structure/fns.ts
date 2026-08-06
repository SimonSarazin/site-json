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
 * WRITE du champ `tags` : ignore sa propre valeur (le champ est `writeOnly`, jamais seedé ni rendu) et
 * dérive depuis `thematic` — même mécanisme que `geo`/`geoPosition`, qui se calculent depuis les champs
 * d'adresse voisins. Renvoie `undefined` quand aucune thématique n'est cochée → la clé est OMISE du
 * payload, donc `Object.assign` en édition ne peut jamais VIDER les tags existants par accident.
 */
registerTransform("structure:tagsFromThematic", (_v, all) => {
  const tags = thematicToTags((all as Record<string, unknown>)?.thematic);
  return tags.length > 0 ? tags : undefined;
});

/**
 * CONTOURNEMENT — chaîne saisie → NOMBRE, en tolérant les séparateurs de saisie.
 *
 * Le costum `sportSanteBienetre` déclare `siren`, `representativeTelephone` et
 * `personInChargeTelephone` en `number`. Ce typage est un artefact d'inférence (`costum-fields.mjs`
 * a déduit le type des valeurs stockées, qui ne contenaient que des chiffres) : la déclaration réelle
 * du costum les donne en `inputType: "text"`, et les données en base sont des CHAÎNES. Tant que
 * l'artefact n'est pas corrigé, AJV rejette la création avec « must be number ».
 * cf. doc-projets/todo-costum-schema-structures-ssbe.md §2.
 *
 * On envoie donc un nombre — mais SANS `coerce:number`, qui rend `undefined` (donc PERD le champ en
 * silence) dès qu'il y a un espace ou un indicatif : `"+261 34 25 363 35"` et `"123 456 789 00012"`
 * y passeraient tous les deux à la trappe. Ici on ne garde que les chiffres, ce qui préserve la
 * valeur dans tous les formats de saisie courants.
 *
 * ⚠ PERTES ASSUMÉES, inhérentes au type `number` (elles disparaîtront avec le correctif d'artefact) :
 *  - le `+` d'un indicatif international : `"+261 34…"` → `261 34…` (le préfixe `00` serait conservé) ;
 *  - un zéro initial : `"0692001122"` → `692001122` (forme déjà observée en base : `"692211490"`).
 * Vide → `undefined` → clé OMISE (jamais `""`, que le type `number` refuserait).
 */
registerTransform("number:fromDigits", (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  const digits = String(v ?? "").replace(/\D/g, "");
  if (!digits) return undefined;
  const n = Number(digits);
  // Au-delà de 2^53 un entier n'est plus représentable fidèlement → on préfère omettre que corrompre.
  return Number.isSafeInteger(n) ? n : undefined;
});
