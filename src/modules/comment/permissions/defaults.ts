import type { CommentPermissions } from "./types";

/** Droits d'un visiteur non identifié : lire, et rien d'autre. */
export const DEFAULT_COMMENT_PERMISSIONS: CommentPermissions = {
  canComment: false,
  canReply: false,
  canReact: false,
  canReport: false,
  canModerate: false,
};
