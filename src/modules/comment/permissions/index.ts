export type { CommentPermissions } from "./types";
export { DEFAULT_COMMENT_PERMISSIONS } from "./defaults";
export { calculateCommentPermissions } from "./calculators/comment";

// Note : pour que les droits soient calculés, importer le register :
//   import "@/modules/comment/permissions/register";
// C'est ce que fait `useCommentPermissions`.
