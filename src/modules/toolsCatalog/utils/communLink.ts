/**
 * Le lien de commun d'un outil (`navigatorcriteria.url` / `.urlTool`) — lecture,
 * réécriture, et le prédicat qui dit si une valeur en est un.
 *
 * DEUX fronts écrivent ce champ, et ils n'écrivent pas la même chose :
 *
 *  1. l'ancre historique `#detail-un-commun.communId.<id>` — les vues legacy
 *     `listTools`, où le commun s'ouvre dans la page CMS elle-même ;
 *  2. la route `…/commun/<id>` — les sites site-json, qui servent la fiche du
 *     commun sur leur PROPRE page de détail (`/aac/commun/<id>`).
 *
 * La seconde est reconnue par le SEGMENT `commun/<24hex>` et jamais par un préfixe
 * en dur : le segment qui le précède appartient au routeur du site et n'a pas à
 * être connu d'un module générique. Cela couvre du même coup la forme absolue
 * `https://<hôte>/aac/commun/<id>`.
 *
 * ⚠️ Ce module est le MIROIR EXACT de `ToolsCatalogListAction::extractCommunId`
 * (costum). Les deux doivent reconnaître les mêmes formes, sans quoi le front
 * écrirait un lien que le serveur ne saurait pas relire — un rattachement qui
 * s'enregistre puis disparaît, sans la moindre erreur. Toute évolution ici se fait
 * des deux côtés, et `communLink.test.ts` porte les mêmes cas que la sonde PHP.
 */

/** Ancre legacy, ancrée sur les 24 hex de la communId. */
const LEGACY_ANCHOR = /#detail-un-commun\.communId\.([0-9a-fA-F]{24})/;

/**
 * Segment de route `commun/<24hex>`. `(?:^|\/)` interdit `…/moncommun/<id>` ;
 * la fin de segment interdit de tronquer un identifiant plus long.
 */
const ROUTE_SEGMENT = /(?:^|\/)commun\/([0-9a-fA-F]{24})(?:[/?#]|$)/;

/**
 * La communId portée par un lien, en minuscules — `""` si le lien n'en porte pas.
 *
 * L'ancre passe AVANT la route : sur un lien qui porterait les deux, c'est elle
 * qui a été écrite en connaissance du domaine cible. Même ordre côté PHP.
 */
export function extractCommunId(url: string | null | undefined): string {
  if (!url) return "";
  const ancre = LEGACY_ANCHOR.exec(url);
  if (ancre) return ancre[1].toLowerCase();
  const route = ROUTE_SEGMENT.exec(url);
  if (route) return route[1].toLowerCase();
  return "";
}

/** `true` si le serveur saura relire une communId dans cette valeur. */
export function isCommunLink(url: string | null | undefined): boolean {
  return extractCommunId(url) !== "";
}

/**
 * Repointe un lien de commun EXISTANT vers un autre commun, en gardant sa forme et
 * son domaine — c'est ce qui permet de rattacher un autre commun sans savoir sur
 * quel site l'outil avait été enrichi.
 *
 * Renvoie `null` si la valeur n'est pas un lien de commun : à l'appelant de
 * construire le lien depuis le gabarit configuré, ou de ne rien écrire du tout.
 */
export function replaceCommunId(url: string, communId: string): string | null {
  if (LEGACY_ANCHOR.test(url)) {
    return url.replace(LEGACY_ANCHOR, `#detail-un-commun.communId.${communId}`);
  }
  if (ROUTE_SEGMENT.test(url)) {
    // Remplacement de la SEULE capture : le préfixe (`/aac/`) et la queue
    // (`?from=…`) sont rendus tels quels.
    return url.replace(ROUTE_SEGMENT, (m, _id: string) => m.replace(/[0-9a-fA-F]{24}/, communId));
  }
  return null;
}

/**
 * Un gabarit (`communUrlTemplate`) produit-il un lien que le serveur saura relire ?
 *
 * On ne teste pas la présence d'un motif : on SUBSTITUE une communId factice —
 * exactement comme `ToolEditDialog` le fera (`replace("{communId}", id)`) — et on
 * relit le résultat avec `extractCommunId`. Le prédicat est donc exactement celui
 * du serveur, et il le restera si les formes acceptées évoluent.
 *
 * Relire « une » communId ne suffit pas : un gabarit qui porte déjà une communId
 * EN DUR (l'URL d'une vraie fiche copiée-collée à la place du gabarit) en rend
 * une aussi, et chaque outil rattaché pointerait alors le même commun, sans la
 * moindre erreur. On substitue donc DEUX identifiants distincts et on exige que
 * le lien rende à chaque fois celui qu'on vient d'y mettre : c'est la preuve que
 * le marqueur est présent ET que c'est lui que le serveur lira.
 */
export function templateYieldsCommunId(template: string): boolean {
  return ["a".repeat(24), "b".repeat(24)].every(
    (id) => extractCommunId(template.replace("{communId}", id)) === id,
  );
}
