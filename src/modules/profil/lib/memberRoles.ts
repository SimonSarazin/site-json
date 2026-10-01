/**
 * Rôles d'un membre DANS l'entité affichée (`links.<famille>[<id>].roles`).
 *
 * Ces rôles sont du TEXTE LIBRE et purement descriptifs : aucun droit n'en découle — les
 * permissions viennent du drapeau `isAdmin` du lien et des rôles de PLATEFORME du compte
 * (`superAdmin`…), qui portent le même nom sans avoir le même sens.
 *
 * Deux sources, dans cet ordre :
 *  1. le contexte de lien porté par le membre lui-même (`userContext.links.<famille>[<entityId>]`),
 *     celui que `isAdmin()` consulte déjà ;
 *  2. à défaut, les liens de l'entité parente (`entity.links.<famille>[<memberId>]`) — `element/about`
 *     projette `links`, donc ils sont disponibles sur l'entité porteuse.
 *
 * La famille dépend du type d'entité : une organisation a des `members`, un projet des
 * `contributors`, un événement des `attendees`. On essaie les trois plutôt que de dupliquer ici la
 * table des types, qui vit déjà dans `useEntityLabels`.
 */
const FAMILLES = ["members", "contributors", "attendees"] as const;

type Sac = Record<string, unknown> | null | undefined;

function lienDans(links: Sac, id: string | null | undefined): Sac {
  if (!links || !id) return null;
  for (const famille of FAMILLES) {
    const groupe = (links as Record<string, unknown>)[famille];
    if (groupe && typeof groupe === "object") {
      const lien = (groupe as Record<string, unknown>)[id];
      if (lien && typeof lien === "object") return lien as Record<string, unknown>;
    }
  }
  return null;
}

function rolesDuLien(lien: Sac): string[] {
  const brut = lien && typeof lien === "object" ? (lien as Record<string, unknown>).roles : null;
  if (!Array.isArray(brut)) return [];
  // Le backend stocke un tableau de chaînes ; on filtre le reste plutôt que d'afficher `[object Object]`.
  return brut.filter((r): r is string => typeof r === "string" && r.trim() !== "").map((r) => r.trim());
}

/** Rôles à afficher pour `membreId` dans l'entité `entiteId`. `[]` si rien n'est renseigné. */
export function rolesDuMembre(
  liensDuMembre: Sac,
  entiteId: string | null | undefined,
  liensDeLEntite: Sac,
  membreId: string | null | undefined,
): string[] {
  const depuisMembre = rolesDuLien(lienDans(liensDuMembre, entiteId));
  if (depuisMembre.length > 0) return depuisMembre;
  return rolesDuLien(lienDans(liensDeLEntite, membreId));
}
