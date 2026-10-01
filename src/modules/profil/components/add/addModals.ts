/**
 * Type d'élément (collection plurielle) → modale d'AJOUT standard du `ModalRegistry`.
 *
 * Les personnes (`citoyens`) n'en ont pas : un compte ne se crée pas depuis un formulaire — un
 * finder de personnes propose l'invitation à la place.
 */
export const STANDARD_ADD_MODAL_BY_TYPE: Readonly<Record<string, string>> = {
  organizations: "add-organization",
  projects: "add-project",
  events: "add-event",
  poi: "add-poi",
};

/** Sous-ensemble utile d'un doc `config.costumForms`. */
export interface CostumFormRef {
  id?: string;
  entityType?: string;
  costumSlug?: string;
}

/**
 * La modale d'ajout du formulaire COSTUM que le site déclare pour cette collection, s'il y en a UN
 * SEUL — celui du costum du site d'abord, sinon un form importé d'un autre costum passerait devant.
 * Plusieurs candidats → `null` : on ne choisit pas à la place du site.
 *
 * Règle commune à l'« Ajouter » d'un profil (`costumCreateKey`), à celui d'un finder coform
 * (`resolveFinderAddNewModal`) et au pas 1 de la création `inherit` de l'admin (`resolveCreateModal`,
 * qui départage en plus par `identity`) : un site qui déclare un formulaire pour un type ne veut pas
 * du formulaire standard, d'où qu'on crée.
 */
export function siteCostumAddModal(
  collection: string,
  costumForms: Record<string, CostumFormRef | undefined> | undefined,
  siteSlug: string | undefined,
): string | null {
  const docs = Object.entries(costumForms ?? {}).filter(([, d]) => d?.entityType === collection);
  const duSite = docs.filter(([, d]) => siteSlug && d?.costumSlug === siteSlug);
  const retenus = duSite.length > 0 ? duSite : docs;
  if (retenus.length !== 1) return null;
  const [cle, doc] = retenus[0];
  return `add-${doc?.id ?? cle}`;
}

/** Type d'ajout d'un profil (« Ajouter une organisation »…). */
export type AddEntityType = "organization" | "project" | "event" | "poi";

/** Type d'ajout → collection, sous laquelle `costumForms` déclare son `entityType`. */
export const COLLECTION_BY_ADD: Readonly<Record<AddEntityType, string>> = {
  organization: "organizations",
  project: "projects",
  event: "events",
  poi: "poi",
};

/**
 * Form COSTUM du site pour ce type d'ajout d'un profil, s'il y en a UN SEUL (`siteCostumAddModal`) :
 * sans cela, « Ajouter un événement » depuis une organisation ouvrait le form générique, et
 * l'événement naissait sans les champs du costum. Plusieurs forms (institutBleu : `document` ET
 * `financement` sur `poi`) → `null`, la modale standard est conservée, et le site déclare l'entrée
 * qu'il veut via `addConfig.custom`.
 */
export function costumCreateKey(
  type: AddEntityType,
  costumForms: Record<string, CostumFormRef | undefined> | undefined,
  siteSlug: string | undefined,
): string | null {
  return siteCostumAddModal(COLLECTION_BY_ADD[type], costumForms, siteSlug);
}
