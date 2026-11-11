/**
 * Annonces de la region vivante du tableau — logique PURE
 * (`tests/unit/liveRegion.test.ts`).
 *
 * Un lecteur d'ecran ne relit pas une region dont le texte n'a pas change :
 * masquer deux colonnes de suite, ou ajouter deux cartes au meme rang,
 * n'aurait ete annonce qu'une fois. Un texte identique au precedent reçoit
 * donc une espace insecable finale (invisible, et ignoree a la lecture), puis
 * la perd a la repetition suivante.
 */
export function nextAnnouncement(previous: string, message: string): string {
  if (message === '') return '';
  return previous === message ? `${message}\u00a0` : message;
}
