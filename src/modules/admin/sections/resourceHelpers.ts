import type { AdminResourceSection } from "../schema";
import { formatDateLong, resolveEventStartDate } from "@/helpers/formatDate";
import { formatRecurrenceLabel, type Translate } from "@/modules/search/lib/openingHoursDays";

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
  /** Discriminant natif du form (`{"type":"recoveryCenter"}`) — départage deux forms d'un même type. */
  identity?: Record<string, unknown>;
}

/**
 * L'`identity` d'un form (comment un NATIF se reconnaît en base) est-elle compatible avec les
 * `defaultFilters` de la resource admin (ce que la table liste) ? Sert UNIQUEMENT à départager
 * plusieurs forms candidats du même `entityType` — ce n'est pas un moteur de requête.
 *
 * Formes reconnues, côté filtre : valeur scalaire (égalité), tableau (`includes`), `{$in:[…]}`.
 * Tout le reste (`$regex`, `$or`, `$exists`, opérateurs imbriqués…) ne matche PAS, délibérément :
 * un départage qui ne sait pas trancher doit rendre la main, pas deviner. L'appelant retombe alors
 * sur la modale standard en le signalant, ce qui est visible — contrairement à un choix arbitraire.
 */
function identiteCompatible(identity: Record<string, unknown> | undefined, filters: Record<string, unknown> | undefined): boolean {
  if (!identity || Object.keys(identity).length === 0 || !filters) return false;
  return Object.entries(identity).every(([cle, attendu]) => {
    // Les filtres Mongo portent leurs chemins pointés en clé LITTÉRALE (`"address.postalCode"`),
    // mais un filtre écrit à la main peut être imbriqué : on tente les deux lectures.
    const brut = cle in filters ? filters[cle] : getPath(filters, cle);
    if (Array.isArray(brut)) return brut.includes(attendu);
    if (brut && typeof brut === "object") {
      const dansIn = (brut as { $in?: unknown }).$in;
      return Array.isArray(dansIn) ? dansIn.includes(attendu) : false;
    }
    return brut === attendu;
  });
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
 *
 * `inherit` DÉPARTAGE en trois temps, tous déterministes :
 *   1. le `costumSlug` du site (un form d'un autre costum ne gagne jamais par défaut) ;
 *   2. s'il reste plusieurs candidats, l'`identity` du form contre les `defaultFilters` de la
 *      resource — un site polymorphe (Saint-Paul : `poi` porte équipements ET articles) a
 *      légitimement deux forms du même type, que seul leur discriminant sépare ;
 *   3. toujours ambigu → modale STANDARD, avec un `console.warn`.
 *
 * Le pas 3 remplace un `docs[0]` qui faisait dépendre le formulaire ouvert de l'ORDRE DES CLÉS
 * dans le JSON : réordonner `costumForms` — geste cosmétique, qu'aucun test ne surveille — changeait
 * silencieusement la modale d'ajout de l'admin. Refuser de choisir aligne aussi cette fonction sur
 * son jumeau public `costumCreateKey` (AddEntityDropdown), qui rendait déjà `null` sur ambiguïté :
 * la MÊME décision était prise différemment des deux côtés pour une même config.
 */
export function resolveCreateModal(
  section: AdminResourceSection,
  costumForms?: Record<string, CostumFormDocLike> | null,
  siteSlug?: string,
): string | null {
  const create = section.create ?? "inherit";
  if (create === false) return null;
  const standard = ADD_MODAL_BY_TYPE[section.entityType] ?? null;
  if (create === "standard") return standard;
  if (typeof create === "string" && create !== "inherit") return create;

  const docs = Object.entries(costumForms ?? {})
    .map(([key, doc]) => ({ key, doc: doc ?? {} }))
    .filter(({ doc }) => doc.entityType === section.entityType);
  if (docs.length === 0) return standard;

  const cle = ({ key, doc }: { key: string; doc: CostumFormDocLike }) => `add-${doc.id ?? key}`;

  // 1. le costum du site prime — sinon un form importé d'un autre costum passerait devant.
  const duSite = docs.filter(({ doc }) => siteSlug && doc.costumSlug === siteSlug);
  const candidats = duSite.length > 0 ? duSite : docs;
  if (candidats.length === 1) return cle(candidats[0]);

  // 2. discriminant natif contre ce que la table liste.
  const parIdentite = candidats.filter(({ doc }) => identiteCompatible(doc.identity, section.source?.defaultFilters));
  if (parIdentite.length === 1) return cle(parIdentite[0]);

  // 3. rendre la main, bruyamment.
  console.warn(
    `[admin] resource « ${section.entityType} » : ${candidats.length} forms costum candidats ` +
      `(${candidats.map(({ key, doc }) => doc.id ?? key).join(", ")}) qu'aucune identity ne départage — ` +
      `modale standard. Poser un « create » explicite sur la section.`,
  );
  return standard;
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

/**
 * Valeur d'une colonne, pour une ligne de la table. Cas général : `getPath` brut. Colonne `startDate` :
 * repli sur `resolveEventStartDate` (`startDateSort`/`startDateSortFormat`) pour un événement ponctuel
 * SANS `startDate` propre — ignoré pour les autres types d'entités (n'ont ni l'un ni l'autre champ).
 * Un récurrent, lui, n'a JAMAIS ces deux champs ici : l'admin liste via `searchCostum` (endpoint
 * générique), qui ne calcule ces occurrences que côté `searchEventsCostum`/l'agenda — cf.
 * `formatColumnCell`, qui prend le relais pour ce cas précis.
 */
export function getColumnValue(obj: unknown, path: string): unknown {
  if (path === "startDate" && obj && typeof obj === "object") {
    return resolveEventStartDate(obj as Record<string, unknown>);
  }
  return getPath(obj, path);
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

/**
 * Cellule complète (valeur + formatage) d'une ligne. Colonne `startDate`, event RÉCURRENT (aucune
 * date résolue par `getColumnValue` — cf. sa doc) : repli sur le libellé de récurrence (« Chaque
 * vendredi », `formatRecurrenceLabel`) à partir de `recurrency`/`openingHours` — CES champs-là sont
 * bien projetés par l'admin (`champsAdmin` dans `AdminResourceTable.tsx`), contrairement à une
 * occurrence calculée. `t` : `useT("modules/search")` (namespace des clés `days.*`/`card.event.*`).
 */
export function formatColumnCell(data: unknown, path: string, t: Translate): string {
  const value = getColumnValue(data, path);
  if (path === "startDate" && value == null && data && typeof data === "object") {
    const sd = data as Record<string, unknown>;
    const label = formatRecurrenceLabel(sd.recurrency, sd.openingHours, t);
    if (label) return label;
  }
  return formatCell(value);
}
