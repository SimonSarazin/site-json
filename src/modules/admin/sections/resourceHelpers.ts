import type { AdminResourceSection } from "../schema";

/** entityType (collection plurielle) → clé de modale d'ajout STANDARD (ModalRegistry). */
const ADD_MODAL_BY_TYPE: Record<string, string> = {
  organizations: "add-organization",
  projects: "add-project",
  events: "add-event",
  poi: "add-poi",
};

/** Sous-ensemble utile d'un doc `config.costumForms` (résolution du form costum du site). */
export interface CostumFormDocLike {
  id?: string;
  entityType?: string;
  costumSlug?: string;
}

/**
 * Résout la clé de modale de CRÉATION d'une resource — le CHOIX costum/standard appartient à la
 * config (`create`) :
 *  - `false` → pas de création ;
 *  - `"standard"` → FORCER la modale standard du type (même si un form costum existe) ;
 *  - `"add-<key>"` → clé forcée explicite (costum `add-<id>` ou standard) ;
 *  - `"inherit"` (défaut) → le form COSTUM du site s'il en existe un pour ce type d'entité
 *    (`config.costumForms` : entityType correspondant, costumSlug du site prioritaire — même form
 *    que le bouton d'ajout public, ex. `add-equipements-sportifs`), sinon la modale standard.
 *    Un site costum qui déclare un form pour `poi` NE VEUT PAS du form standard dans son admin :
 *    les champs métier (equip_*) vivent dans le costum.
 */
export function resolveCreateModal(
  section: AdminResourceSection,
  costumForms?: Record<string, CostumFormDocLike> | null,
  siteSlug?: string,
): string | null {
  const create = section.create ?? "inherit";
  if (create === false) return null;
  if (create === "standard") return ADD_MODAL_BY_TYPE[section.entityType] ?? null;
  if (typeof create === "string" && create !== "inherit") return create;
  // inherit : form costum du site pour ce type d'abord (costumSlug du site prioritaire si plusieurs).
  const docs = Object.entries(costumForms ?? {})
    .map(([key, doc]) => ({ key, doc: doc ?? {} }))
    .filter(({ doc }) => doc.entityType === section.entityType);
  if (docs.length > 0) {
    const preferred = docs.find(({ doc }) => siteSlug && doc.costumSlug === siteSlug) ?? docs[0];
    return `add-${preferred.doc.id ?? preferred.key}`;
  }
  return ADD_MODAL_BY_TYPE[section.entityType] ?? null;
}

/**
 * Résout la modale d'ÉDITION d'une resource — même contrat de choix que `create` (`edit`) :
 *  - `false` → pas d'action Éditer ;
 *  - `"inherit"` (défaut) → `null` = résolution PUBLIQUE (DynamicEditModal :
 *    `profiles[type].editModal` + `editModalMatch` sur serverData — comportement identique au
 *    site hors admin) ;
 *  - `"standard"` → forcer le form générique (`edit-profile`) ;
 *  - `"edit-<key>"` → clé forcée explicite (costum `edit-<id>` pour TOUTES les lignes).
 */
export function resolveEditModal(section: AdminResourceSection): { enabled: boolean; modalName: string | null } {
  const edit = section.edit ?? "inherit";
  if (edit === false) return { enabled: false, modalName: null };
  if (edit === "standard") return { enabled: true, modalName: "edit-profile" };
  if (typeof edit === "string" && edit !== "inherit") return { enabled: true, modalName: edit };
  return { enabled: true, modalName: null }; // inherit → résolution publique
}

/** Lit un chemin pointé (ex. `"address.city"`) dans un objet. */
export function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

/** Rendu texte d'une valeur de cellule (les colonnes ciblent des champs plats). */
export function formatCell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "✓" : "—";
  return "";
}
