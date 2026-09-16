import { getEntityId, toArrayOrValues } from "@/modules/cagnotte/utils/dataTransform";
import { pickProfileImageUrl } from "@/modules/coform/utils/helpers";

export interface CommunContributor {
  id: string;
  /** Vide quand la fiche n'en porte pas — le repli d'affichage est à l'UI. */
  name: string;
  /** Absent = pas de page profil à ouvrir. */
  slug?: string;
  imageUrl?: string;
  /** `citoyens` | `organizations` — décide de l'icône de repli. */
  type: string;
  /** Administrateur·rice du projet, d'après `links.contributors.<id>.isAdmin`. */
  isAdmin: boolean;
  /**
   * Rôles déclarés dans le projet (« Développeuse », « Animation »…). TOUJOURS un
   * tableau, vide à défaut : l'appelant n'a jamais à distinguer absent de vide.
   */
  roles: string[];
}

export interface ContributorSource {
  id?: string | null;
  slug?: string | null;
  serverData?: Record<string, unknown> | null;
  getEntityType?: () => string;
}

export function isAdminContributorLink(link: unknown): boolean {
  if (!link || typeof link !== "object") return false;
  const flag = (link as { isAdmin?: unknown }).isAdmin;
  return flag === true || flag === "true";
}

export function toContributorRoles(link: unknown): string[] {
  if (!link || typeof link !== "object") return [];
  const raw = (link as { roles?: unknown }).roles;
  const list = typeof raw === "string" ? [raw] : toArrayOrValues<unknown>(raw);

  const roles: string[] = [];
  for (const value of list) {
    if (typeof value !== "string") continue;
    const role = value.trim();
    if (role !== "" && !roles.includes(role)) roles.push(role);
  }
  return roles;
}

export function isProjectAdmin(
  project: { isAdmin?: (options?: { silent?: boolean }) => boolean } | null | undefined,
): boolean {
  if (typeof project?.isAdmin !== "function") return false;
  try {
    return project.isAdmin({ silent: true }) === true;
  } catch {
    // `isAdmin()` lève quand l'entité n'a pas de contexte utilisateur exploitable.
    // Pas de lien vérifiable = pas de droit, jamais de page cassée.
    return false;
  }
}

export function canInviteContributors(
  project: Parameters<typeof isProjectAdmin>[0],
  options?: { isCommunAuthor?: boolean },
): boolean {
  return options?.isCommunAuthor === true || isProjectAdmin(project);
}

export function toCommunContributors(
  members: readonly ContributorSource[] | null | undefined,
  projectLinks: Record<string, unknown> | null | undefined,
): CommunContributor[] {
  const links = projectLinks ?? {};
  const byId = new Map<string, CommunContributor>();

  for (const member of members ?? []) {
    const serverData = member?.serverData ?? {};
    const id = getEntityId(member) || getEntityId(serverData);
    if (!id || byId.has(id)) continue;

    const rawName = serverData.name;
    const rawSlug = member?.slug ?? serverData.slug;

    byId.set(id, {
      id,
      name: typeof rawName === "string" ? rawName.trim() : "",
      slug: typeof rawSlug === "string" && rawSlug.trim() !== "" ? rawSlug : undefined,
      imageUrl: pickProfileImageUrl(serverData),
      type: member?.getEntityType?.() ?? (typeof serverData.type === "string" ? serverData.type : "citoyens"),
      isAdmin: isAdminContributorLink(links[id]),
      roles: toContributorRoles(links[id]),
    });
  }

  return Array.from(byId.values()).sort((a, b) => {
    if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
    if (!a.name || !b.name) return a.name ? -1 : b.name ? 1 : 0;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}
