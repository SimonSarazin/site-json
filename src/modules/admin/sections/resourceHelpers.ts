import type { AdminResourceSection } from "../schema";

/** entityType (collection plurielle) → clé de modale d'ajout STANDARD (ModalRegistry). */
const ADD_MODAL_BY_TYPE: Record<string, string> = {
  organizations: "add-organization",
  projects: "add-project",
  events: "add-event",
  poi: "add-poi",
};

/**
 * Résout la clé de modale de CRÉATION d'une resource (cf. plan §4 — 3 modes) :
 *  - `false` → pas de création ;
 *  - `"add-<key>"` → clé forcée (standard OU costum `add-<id>`) ;
 *  - `"inherit"` (défaut) → modale standard du type (le scope costum source.key est estampillé
 *    automatiquement par resolveModalSpec via le carrier).
 */
export function resolveCreateModal(section: AdminResourceSection): string | null {
  const create = section.create ?? "inherit";
  if (create === false) return null;
  if (typeof create === "string" && create !== "inherit") return create;
  return ADD_MODAL_BY_TYPE[section.entityType] ?? null;
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
