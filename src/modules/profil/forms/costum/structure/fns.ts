/**
 * Dérivation `tags` ⇐ `thematic` — clé `structure:tagsFromThematic`, PARTAGÉE par les deux
 * formulaires « structure » du parc :
 *  - Ekilib.re      → `config.prod.maison-sport-sante-la-tampon.json` → `costumForms["structure"]`
 *  - sportSanteBienetre → `config.prod.sport-sante-bien-etre.json` → `costumForms["sport-sante-bienetre-organizations"]`
 *
 * `tags` est un pur MIROIR de `thematic` : recopie À L'IDENTIQUE (aucun raccourci de libellé),
 * dédoublonnée, ordre d'entrée préservé. C'est le comportement du hook jQuery legacy (`data.map.thematic`
 * poussé tel quel dans `tplCtx.value.tags`), confirmé par les fiches réelles où `thematic` et `tags`
 * sont strictement égaux. Plus de préservation de tag « étranger » : l'unique marqueur qui vivait
 * dans `tags` (« mss ») est désormais un CHAMP propre du formulaire.
 *
 * Un transform de CHAMP ne reçoit pas de `params` (seuls les `serializeGroups` en ont, cf.
 * `fieldPipeline.valuesToPayload`) et doit lire `thematic` via `all` → d'où ce fichier plutôt qu'une
 * clé de config. Tout le reste (scope, defaults, payload, codecs `address:*`/`social:*`/`geo:*`) est
 * générique, garanti par `../sharedRegistrations`.
 */
import { registerTransform } from "@/modules/formEngine/engine/transforms";
import "../sharedRegistrations"; // side-effect : clés génériques (address/social/geo/coerce/invalidate…)

/** `thematic` → `tags` : dédoublonné, ordre d'entrée préservé, valeurs recopiées telles quelles. */
export function thematicToTags(thematic: unknown): string[] {
  if (!Array.isArray(thematic)) return [];
  return [...new Set(thematic.filter((v): v is string => typeof v === "string" && v.length > 0))];
}

/**
 * WRITE du champ `tags` : miroir dédoublonné de `thematic`.
 * - CRÉATION : clé OMISE si `thematic` est vide (jamais d'écrasement accidentel) ;
 * - ÉDITION : si `thematic` est vidé alors que `tags` en portait, on émet `[]` (effacement serveur) ;
 * - sinon : exactement les valeurs de `thematic`, dans l'ordre, sans doublon.
 * `tags` n'est pas `writeOnly` : sa valeur courante (`v`) est seedée, mais elle ne sert qu'à
 * distinguer « rien à écrire » (création) de « effacer » (édition).
 */
registerTransform("structure:tagsFromThematic", (v, all) => {
  const hadTags = Array.isArray(v) && v.some((t) => typeof t === "string" && t.length > 0);
  const next = thematicToTags((all as Record<string, unknown> | undefined)?.thematic);
  if (next.length === 0) return hadTags ? [] : undefined;
  return next;
});

// NB : le contournement `number:fromDigits` (siren/téléphones coercés en NOMBRE tronqué — perte du
// 0 initial et du « + ») a été SUPPRIMÉ : sa prémisse était fausse. L'artefact costum livré déclare
// ces trois champs en `oneOf string|number` — les CHAÎNES passent l'AJV telles quelles, et la
// politique du repo est le stockage string byte-fidèle. Les champs restent du texte brut.
