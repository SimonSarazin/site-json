/**
 * Costum « parent62-article » — codecs du champ `tags` : chaque TYPE d'actualité coché (`category`, choix
 * multiple stocké en texte « a, b ») pose un mot-clé public, et ces mots-clés suivent les types à chaque
 * enregistrement (cf. `../derivedTags`).
 *
 * La table vit ICI et non dans la config : un codec de CHAMP ne reçoit aucun paramètre (seuls les
 * `serializeGroups` en ont), et un groupe vidé en édition s'efface en `""` — une chaîne là où `tags` attend
 * un tableau. `article.configDriven.test.ts` vérifie que chaque clé est bien un type du formulaire et que
 * « À la une » pose exactement le tag filtré par le carrousel de l'accueil.
 */
import { registerTransform } from "@/modules/formEngine/engine/transforms";
import { tagsAvecDerive, tagsSansDerive } from "../derivedTags";

/** Type d'actualité → mot-clé lu par les pages (`/appels-a-projets`, `/offres-emploi`) et sections (carrousel « à la une »). */
export const TAG_PAR_TYPE_ACTUALITE: Readonly<Record<string, string>> = {
  "appel-projet": "Appels à projets",
  "offre-emploi": "Offres d'emploi",
  "a-la-une": "A la une",
  "zoom": "Zoom",
};

// read : (tags serveur, serverData) — `seedFromEntity` passe l'entité en 2ᵉ argument ; `category` y est le texte stocké.
registerTransform("p62article:tagsRead", (tags, serveur) =>
  tagsSansDerive(tags, (serveur as Record<string, unknown>).category, TAG_PAR_TYPE_ACTUALITE));
// write : (tags saisis, valeurs du formulaire) — `valuesToPayload` passe toutes les valeurs ; `category` y est un tableau.
registerTransform("p62article:tagsWrite", (tags, valeurs) =>
  tagsAvecDerive(tags, (valeurs as Record<string, unknown>).category, TAG_PAR_TYPE_ACTUALITE));
