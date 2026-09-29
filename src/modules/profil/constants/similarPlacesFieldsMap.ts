/**
 * Mapping `keyPath -> valuePath` piloté par l'onglet « Tiers-lieux similaires » du legacy
 * (`costum.views.custom.franceTierslieux.listOrga`, section `mySimilarTr`) : chaque org membre est
 * scorée sur ces 25 champs de réponse au formulaire d'auto-évaluation (`63e0a8abeac0741b506fb4f7`) via
 * `FRANCETIERSLIEUX_GETAGGREGATETR.allPaths`.
 *
 * Vient d'un document Mongo (collection `mappings`, `_id: "64f987cf01e4500d4019a9f0"`,
 * `key: "trSimilary"`) — lu en JS legacy via `showAllNetwork.getElement("mappings",
 * "64f987cf01e4500d4019a9f0")` (`POST /co2/element/get/type/mappings`, `id: <cet id>`). Vérifié le
 * 28/09/2026 en interrogeant DIRECTEMENT ce document sur le backend local
 * (`~/dev/communecter-dev`) — contenu réel, pas une reconstruction.
 *
 * Recopié ICI en dur plutôt que refetché à l'exécution : c'est une donnée de RÉFÉRENCE fixe (liée à
 * un id de document stable), même nature que les formIds/stepIds déjà codés en dur partout ailleurs
 * dans ce module (`useNewsDetailUrlGenerator.tsx`, etc.) — pas une donnée utilisateur. Un endpoint SDK
 * générique « lire n'importe quel élément par id » (`co2/element/get/type/{type}`, AUCUNE restriction
 * de collection côté serveur) a été envisagé puis écarté : périmètre trop large pour ce seul besoin.
 *
 * Si ce document change en production, cette copie devient périmée SANS aucune alerte — à re-vérifier
 * ponctuellement si l'onglet Similaires cesse de paraître pertinent.
 */
export const SIMILAR_PLACES_FIELDS_MAP: Readonly<Record<string, string>> = {
  multiCheckboxPlusfranceTierslieux1522023_146_2le5osg2xb6hjxhv95op:
    "answers.franceTierslieux1522023_146_2.multiCheckboxPlusfranceTierslieux1522023_146_2le5osg2xb6hjxhv95op",
  multiCheckboxPlusfranceTierslieux1522023_146_2le5osg2y8qd7qkuri9q:
    "answers.franceTierslieux1522023_146_2.multiCheckboxPlusfranceTierslieux1522023_146_2le5osg2y8qd7qkuri9q",
  multiCheckboxPlusfranceTierslieux1522023_146_2le5osg2y582k4q3cven:
    "answers.franceTierslieux1522023_146_2.multiCheckboxPlusfranceTierslieux1522023_146_2le5osg2y582k4q3cven",
  multiCheckboxPlusfranceTierslieux1522023_146_2le5osg2zax9w5wl3wh7:
    "answers.franceTierslieux1522023_146_2.multiCheckboxPlusfranceTierslieux1522023_146_2le5osg2zax9w5wl3wh7",
  multiCheckboxPlusfranceTierslieux1522023_146_2lf23xxwg6123rjt0e05:
    "answers.franceTierslieux1522023_146_2.multiCheckboxPlusfranceTierslieux1522023_146_2lf23xxwg6123rjt0e05",
  multiCheckboxPlusfranceTierslieux1822023_1721_4lea64x9qwknlysdiuab:
    "answers.franceTierslieux1822023_1721_4.multiCheckboxPlusfranceTierslieux1822023_1721_4lea64x9qwknlysdiuab",
  multiCheckboxPlusfranceTierslieux1822023_1721_4lea64x9sc9ir9qxm5q8:
    "answers.franceTierslieux1822023_1721_4.multiCheckboxPlusfranceTierslieux1822023_1721_4lea64x9sc9ir9qxm5q8",
  multiCheckboxPlusfranceTierslieux1822023_1721_4lea64x9sopbxs1rgowa:
    "answers.franceTierslieux1822023_1721_4.multiCheckboxPlusfranceTierslieux1822023_1721_4lea64x9sopbxs1rgowa",
  franceTierslieux1922023_1231_5lebb61gowlj39f2a2e:
    "answers.franceTierslieux1922023_1231_5.franceTierslieux1922023_1231_5lebb61gowlj39f2a2e",
  franceTierslieux1922023_1231_5lebb61gpa1kh26lte5v:
    "answers.franceTierslieux1922023_1231_5.franceTierslieux1922023_1231_5lebb61gpa1kh26lte5v",
  multiCheckboxPlusfranceTierslieux1922023_1231_5lebb61gqo9uqmrsfe3:
    "answers.franceTierslieux1922023_1231_5.multiCheckboxPlusfranceTierslieux1922023_1231_5lebb61gqo9uqmrsfe3",
  multiCheckboxPlusfranceTierslieux1922023_1231_5lebb61grdlxbeeoxi5:
    "answers.franceTierslieux1922023_1231_5.multiCheckboxPlusfranceTierslieux1922023_1231_5lebb61grdlxbeeoxi5",
  multiCheckboxPlusfranceTierslieux1922023_1231_5lebb61gs4vh3p1z8507:
    "answers.franceTierslieux1922023_1231_5.multiCheckboxPlusfranceTierslieux1922023_1231_5lebb61gs4vh3p1z8507",
  multiCheckboxPlusfranceTierslieux1922023_1231_6lebdout8liagfm99v2r:
    "answers.franceTierslieux1922023_1231_6.multiCheckboxPlusfranceTierslieux1922023_1231_6lebdout8liagfm99v2r",
  multiCheckboxPlusfranceTierslieux1922023_1231_6lebdout9qitprmvmmwt:
    "answers.franceTierslieux1922023_1231_6.multiCheckboxPlusfranceTierslieux1922023_1231_6lebdout9qitprmvmmwt",
  multiCheckboxPlusfranceTierslieux1922023_1417_7lebeyrjawvepz1qnmpr:
    "answers.franceTierslieux1922023_1417_7.multiCheckboxPlusfranceTierslieux1922023_1417_7lebeyrjawvepz1qnmpr",
  franceTierslieux1922023_1523_8lebhb3krbh75vzt4zx8:
    "answers.franceTierslieux1922023_1523_8.franceTierslieux1922023_1523_8lebhb3krbh75vzt4zx8",
  franceTierslieux1922023_1523_8lebhb3kspv107f7t2u:
    "answers.franceTierslieux1922023_1523_8.franceTierslieux1922023_1523_8lebhb3kspv107f7t2u",
  multiCheckboxPlusfranceTierslieux1922023_1523_8lebhb3kpten7snuxq8:
    "answers.franceTierslieux1922023_1523_8.multiCheckboxPlusfranceTierslieux1922023_1523_8lebhb3kpten7snuxq8",
  multiCheckboxPlusfranceTierslieux1922023_1523_8lebhb3ksia7gl9gzhjs:
    "answers.franceTierslieux1922023_1523_8.multiCheckboxPlusfranceTierslieux1922023_1523_8lebhb3ksia7gl9gzhjs",
  multiCheckboxPlusfranceTierslieux2022023_732_9lecfwuxxmpnldq01ein:
    "answers.franceTierslieux2022023_732_9.multiCheckboxPlusfranceTierslieux2022023_732_9lecfwuxxmpnldq01ein",
  multiCheckboxPlusfranceTierslieux2022023_732_9lecfwuxycsulczunyp:
    "answers.franceTierslieux2022023_732_9.multiCheckboxPlusfranceTierslieux2022023_732_9lecfwuxycsulczunyp",
  multiCheckboxPlusfranceTierslieux2022023_732_9lecfwuxzubxy5nb7i9k:
    "answers.franceTierslieux2022023_732_9.multiCheckboxPlusfranceTierslieux2022023_732_9lecfwuxzubxy5nb7i9k",
  multiCheckboxPlusfranceTierslieux2022023_753_10lecgnz64sxfldf7jfb:
    "answers.franceTierslieux2022023_753_10.multiCheckboxPlusfranceTierslieux2022023_753_10lecgnz64sxfldf7jfb",
  multiCheckboxPlusfranceTierslieux2022023_753_10lecgnz655wcvmc0ftkf:
    "answers.franceTierslieux2022023_753_10.multiCheckboxPlusfranceTierslieux2022023_753_10lecgnz655wcvmc0ftkf",
};
