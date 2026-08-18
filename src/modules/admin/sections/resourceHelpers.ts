import type { AdminResourceSection } from "../schema";
import { formatDateLong } from "@/helpers/formatDate";

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

/** Lit un champ de statut (mode `statusField`) : chemin complet d'abord, puis la clé FEUILLE à plat.
 *  Le `field` de config est LE chemin Mongo imbriqué (`answers.<formKey>.<clé>`) — c'est lui que
 *  consomment le filtre serveur et l'écriture UPDATE_PATH_VALUE — mais les hooks costum de recherche
 *  APLATISSENT les champs d'answer au top-level de la ligne en supprimant `answers.*`
 *  (ex. `SportSanteBienetre::…` : `$allAnswers[$key][$k] = $v; unset(…["answers"])`). */
export function readStatusValue(data: unknown, path: string): unknown {
  const direct = getPath(data, path);
  if (direct !== undefined) return direct;
  const leaf = path.split(".").pop();
  return leaf && data && typeof data === "object" ? (data as Record<string, unknown>)[leaf] : undefined;
}

/** Rendu texte d'une valeur de cellule (les colonnes ciblent des champs plats,
 *  plus les deux sérialisations MongoDate du backend — `created`/`updated`). */
export function formatCell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "✓" : "—";
  // Un champ MULTIVALUÉ est un tableau : sans ce cas il tombait dans le `return ""` final, et la colonne
  // restait VIDE alors que la donnée était là (mesuré : 610 des 686 documents d'institutBleu portent un
  // `organisme`, tous en tableau de chaînes). Vaut aussi pour `auteurs`, `territoires`, `tags`…
  if (Array.isArray(value)) {
    const rendus = value.map((v) => formatCell(v)).filter((x) => x !== "" && x !== "—");
    return rendus.length ? rendus.join(", ") : "—";
  }
  if (typeof value === "object") {
    // La lib revivifie les timestamps (`created`…) en Date sur serverData.
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? "—" : formatDateLong(value);
    const { sec, $date } = value as { sec?: unknown; $date?: unknown };
    if (typeof sec === "number") return formatDateLong(sec * 1000);
    if (typeof $date === "number" || typeof $date === "string") return formatDateLong($date);
    const long = ($date as { $numberLong?: unknown } | undefined)?.$numberLong;
    if (typeof long === "string") return formatDateLong(Number(long));
  }
  return "";
}
