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
import { telephonePrincipal } from "@/lib/telephonePrincipal";
import { siteWebPrincipal } from "@/lib/siteWebPrincipal";
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

/**
 * READ du champ `mobile` : le formulaire écrit un `mobile` PLAT (seule clé déclarée par les deux
 * costums), mais la plupart des fiches ne portent que `telephone.mobile`/`telephone.fixe` (123/148 en
 * prod SSBE, 24/09) et s'ouvraient avec un téléphone vide. On pré-remplit avec le même numéro que
 * celui affiché sur la fiche : `mobile` plat s'il existe, sinon `telephone`.
 */
registerTransform("structure:mobileRead", (_v, all) =>
  telephonePrincipal(all as Record<string, unknown> | undefined),
);

/**
 * READ du champ `link` (site web) : le formulaire écrit `link`, comme le legacy ssbe.re, mais le site
 * web de la plupart des fiches anciennes vit dans `url` (43/148 fiches SSBE n'ont que `url` en prod,
 * 24/09), qui s'ouvraient avec un champ vide. Même valeur que celle affichée sur la fiche.
 */
registerTransform("structure:linkRead", (_v, all) =>
  siteWebPrincipal(all as Record<string, unknown> | undefined),
);

// NB : le contournement `number:fromDigits` (siren/téléphones coercés en NOMBRE tronqué — perte du
// 0 initial et du « + ») a été SUPPRIMÉ : sa prémisse était fausse. L'artefact costum livré déclare
// ces trois champs en `oneOf string|number` — les CHAÎNES passent l'AJV telles quelles, et la
// politique du repo est le stockage string byte-fidèle. Les champs restent du texte brut.
