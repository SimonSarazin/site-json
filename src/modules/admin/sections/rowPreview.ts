/**
 * Ligne de table « un clic ouvre le détail » (`resource.preview`, `answerCopy.preview`) : le contrat
 * commun aux deux tables admin, pour qu'elles ne divergent pas.
 *
 * Deux clics ne demandent PAS le détail :
 *  - celui qui TERMINE une sélection de texte — glisser pour copier un code postal ou un e-mail se
 *    finit par un `click` sur la ligne : le détail s'ouvrirait par-dessus et la sélection serait perdue ;
 *  - celui qui vise un CONTRÔLE de la ligne (case de sélection, lecteur audio, menu d'actions) : ces
 *    cellules le gardent pour elles avec `stopRowClick`.
 *
 * Limite assumée : un double-clic (sélection d'un mot) ouvre le détail dès son PREMIER clic — le
 * navigateur ne sélectionne qu'au second. Différer l'ouverture pour l'attendre retarderait chaque
 * consultation ; on copie au glisser.
 *
 * Sans `open` (pas de bloc `preview`), aucune prop : la ligne ne réagit pas et n'en a pas l'air.
 */
export function rowPreviewProps(open: (() => void) | undefined): { className?: string; onClick?: () => void } {
  if (!open) return {};
  return {
    className: "cursor-pointer",
    onClick: () => {
      // Un clic simple réduit la sélection à un point AVANT l'événement `click` : chaîne vide.
      if (window.getSelection()?.toString()) return;
      open();
    },
  };
}

/**
 * Cellule qui porte un CONTRÔLE (case, lecteur audio, menu « ⋯ ») : son clic ne remonte pas à la ligne.
 * Posé sur la cellule entière, padding compris — un clic qui manque le bouton de peu vise encore le
 * contrôle, pas le détail. Indispensable pour le menu : React fait remonter jusqu'à la ligne les clics
 * de son contenu, pourtant PORTALÉ hors du tableau.
 */
export function stopRowClick(event: { stopPropagation: () => void }): void {
  event.stopPropagation();
}
