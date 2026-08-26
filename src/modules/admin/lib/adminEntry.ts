import type { AdminAccessLevel } from "../schema";
import type { SiteConfig } from "@/types/site-schema";

const RANK: Record<AdminAccessLevel, number> = {
  entityAdmin: 1,
  siteAdmin: 2,
  superAdmin: 3,
};

/** Objets lib minimaux consommés par la résolution d'accès (User / entité carrier). */
interface MeLike { isSuperAdmin?: () => boolean; isAdminPlatform?: () => boolean }
interface CarrierLike { isAdmin?: () => boolean }

/**
 * Niveau d'accès admin — fonction PURE (partagée entre `useAdminAccess` et les contextes sans hook :
 * source de palette de commandes). superAdmin (plateforme) > siteAdmin (admin du carrier costum).
 * `entityAdmin` est résolu PAR-LIGNE dans les tables (pas ici).
 */
export function resolveAdminAccessLevel(me: MeLike | null | undefined, entity: CarrierLike | null | undefined): AdminAccessLevel | null {
  if (me?.isSuperAdmin?.() || me?.isAdminPlatform?.()) return "superAdmin";
  if (entity?.isAdmin?.()) return "siteAdmin";
  return null;
}

/** `level` satisfait-il `required` ? (hiérarchie RANK) */
export function levelSatisfies(level: AdminAccessLevel | null, required: AdminAccessLevel): boolean {
  return level != null && RANK[level] >= RANK[required];
}

/**
 * L'entrée « Administration » (menu avatar, palette Ctrl+K) doit-elle être visible ?
 * = admin activé en config ET l'utilisateur atteint `config.admin.access.min` (défaut siteAdmin) —
 * le MÊME gate que la page `/admin` (AdminPage) : jamais de lien vers une page qui refusera.
 */
export function isAdminEntryVisible(
  config: Pick<SiteConfig, "admin"> | null | undefined,
  me: MeLike | null | undefined,
  entity: CarrierLike | null | undefined,
): boolean {
  const admin = config?.admin;
  if (!admin || admin.enabled === false) return false;
  return levelSatisfies(resolveAdminAccessLevel(me, entity), admin.access?.min ?? "siteAdmin");
}

/**
 * L'entrée « Kanban » du menu avatar (lien externe vers la vue actions de la plateforme) doit-elle
 * être visible ? Opt-in `config.auth.menu.kanban` — INDÉPENDANT de `admin.enabled`/`access.min`
 * (le back-office peut rester désactivé) — réservé aux admins du costum (siteAdmin, superAdmin
 * compris), et jamais sans slug de carrier résolu : pas de lien cassé.
 */
export function isKanbanEntryVisible(
  config: Pick<SiteConfig, "auth"> | null | undefined,
  me: MeLike | null | undefined,
  entity: CarrierLike | null | undefined,
  costumSlug: string | null | undefined,
): boolean {
  if (!config?.auth?.menu?.kanban || !costumSlug) return false;
  return levelSatisfies(resolveAdminAccessLevel(me, entity), "siteAdmin");
}
