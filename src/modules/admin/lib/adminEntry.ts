import type { AdminAccessLevel } from "../schema";
import type { SiteConfig } from "@/types/site-schema";
import { KANBAN_HOME_PATH } from "@/modules/kanban/lib/kanbanPaths";
import { platformKanbanUrl } from "./platformKanbanUrl";

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

/** Carrier vu par l'entrée « Kanban » : admin, membre (organisation) ou contributeur (projet). */
interface CarrierMemberLike extends CarrierLike {
  isMember?: () => boolean;
  isContributor?: () => boolean;
}

/**
 * Cible de l'entrée « Kanban » du menu avatar : la page `/kanban` du module (même onglet), ou
 * l'ancien lien vers la vue actions de la plateforme (nouvel onglet).
 */
export type KanbanEntry = { kind: "module"; to: string } | { kind: "platform"; href: string };

export interface KanbanEntryContext {
  /** Slug du carrier (`entity.slug`) : sans lui, pas de lien vers la plateforme. */
  costumSlug: string | null | undefined;
  /** Type de l'élément porteur (`useCocolight().contextType`). */
  contextType: string | null | undefined;
  /** Base de la plateforme (`getServerUrl()`), pour l'ancien lien. */
  serverUrl: string;
}

/**
 * L'entrée « Kanban » du menu avatar, ou `null` si elle n'a pas lieu d'être. Opt-in
 * `config.auth.menu.kanban`, INDÉPENDANT de `admin.enabled`/`access.min` (le back-office peut
 * rester désactivé).
 *
 * - **Module `kanban` actif** (`config.kanban`) : l'entrée mène à `/kanban`, dans le même onglet,
 *   en remplacement de l’ancien lien (RFC kanban, Q8). Elle est montrée à qui le serveur ouvre le
 *   tableau : admins du porteur (superAdmin compris), membres d'une organisation, contributeurs
 *   d'un projet (Q5). Seuls une organisation et un projet ont un kanban : ailleurs, rien.
 * - **Sans le module** : l'ancien lien vers la vue actions de la plateforme, réservé aux admins du
 *   costum, et jamais sans slug de carrier résolu (pas de lien cassé).
 *
 * Le serveur reste juge : un membre que la page refuserait (lien en attente de validation) y lit
 * « Réservé aux membres ».
 */
export function resolveKanbanEntry(
  config: Pick<SiteConfig, "auth" | "kanban"> | null | undefined,
  me: MeLike | null | undefined,
  entity: CarrierMemberLike | null | undefined,
  { costumSlug, contextType, serverUrl }: KanbanEntryContext,
): KanbanEntry | null {
  if (!config?.auth?.menu?.kanban) return null;
  const isAdmin = levelSatisfies(resolveAdminAccessLevel(me, entity), "siteAdmin");
  if (config.kanban) {
    if (contextType !== "organizations" && contextType !== "projects") return null;
    const linked = contextType === "organizations" ? entity?.isMember?.() === true : entity?.isContributor?.() === true;
    return isAdmin || linked ? { kind: "module", to: KANBAN_HOME_PATH } : null;
  }
  if (!costumSlug || !isAdmin) return null;
  return { kind: "platform", href: platformKanbanUrl(serverUrl, costumSlug) };
}
