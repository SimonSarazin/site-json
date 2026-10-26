/**
 * Droits du module comment.
 *
 * Distinction volontaire par rapport au module `news`, dont les deux droits de commentaire
 * (`canEditComment`, `canDeleteComment`) n'étaient en pratique lus par aucun composant.
 * Ici, chaque droit a un consommateur : si l'un d'eux devient mort, c'est qu'il faut le retirer.
 */
export interface CommentPermissions {
  /** Poster un message racine dans ce fil. */
  canComment: boolean;
  /** Répondre à un message existant. */
  canReply: boolean;
  /** Réagir (les huit émotions). */
  canReact: boolean;
  /** Signaler un abus. */
  canReport: boolean;
  /**
   * Supprimer ou masquer le message **d'autrui**. L'auteur d'un message peut toujours
   * modifier et supprimer le sien : cela ne dépend pas de ce droit mais de l'identité.
   */
  canModerate: boolean;
}
