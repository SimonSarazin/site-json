/**
 * Module aac/permissions — Exports.
 *
 * Pour activer les permissions aac, importer le register côté entry (side-effect) :
 *   import "@/modules/aac/permissions/register";
 * puis consommer via le hook ergonomique `useAacPermissions(entity, data)`.
 */
export type {
  AacPermissions,
  AacPermissionData,
  AacGateFlags,
  AacCommunLike,
} from "./types";
export { DEFAULT_AAC_PERMISSIONS } from "./defaults";
export { calculateAacPermissions } from "./calculators/aac";
