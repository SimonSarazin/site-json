import type { EntityTypes, SearchEntity } from "@communecter/cocolight-api-client";
import {
  STANDARD_ADD_MODAL_BY_TYPE,
  isOpenableAddModal,
  type CostumFormRef,
} from "@/modules/profil/components/add/addModals";
import type { FinderElement, FinderElementType } from "../types";
import { toFinderSearchResult } from "./toFinderSearchResult";

/** Une entrée de `coform.finderAddNew` : sa clé (question ou type) et ce que le site y a écrit. */
export interface FinderAddNewDeclaration {
  key: string;
  value: unknown;
}

/**
 * La déclaration `coform.finderAddNew` qui s'applique à ce finder : celle de la QUESTION (clé
 * `finder<étape><id>`) — deux finders d'un même type peuvent vouloir deux formulaires —, sinon celle
 * du TYPE cherché. `null` : le site ne déclare rien pour lui.
 *
 * Une valeur vide n'est pas une déclaration ; toute autre l'est, même mal formée (la config n'est pas
 * validée au runtime) — c'est à `resolveFinderAddNewModal` de la refuser, pas de l'ignorer.
 */
export function finderAddNewDeclaration(
  mapping: Record<string, unknown> | undefined,
  fieldName: string | undefined,
  type: string,
): FinderAddNewDeclaration | null {
  for (const key of [fieldName, type]) {
    if (!key || !mapping || !Object.prototype.hasOwnProperty.call(mapping, key)) continue;
    const value = mapping[key];
    if (value !== undefined && value !== null && value !== "") return { key, value };
  }
  return null;
}

/**
 * La modale d'AJOUT qu'ouvre le bouton « Ajouter » d'un finder (réglage `addNew` du legacy) : celle
 * que le site déclare pour lui (`finderAddNewDeclaration`), sinon la modale standard du type.
 *
 * Un formulaire costum ne s'ouvre QUE déclaré : il estampille ce qu'il crée — sous-type, mots-clés,
 * rattachement au costum —, et ce choix revient au site. Le legacy, lui, prenait d'office celui du
 * costum pour le type (`costum.typeObj[type].dynFormCostum`).
 *
 * Une déclaration qui ne désigne aucune modale ouvrable (faute de frappe, formulaire retiré de
 * `costumForms`, valeur mal formée) ne retombe PAS sur le niveau suivant : le site a demandé un
 * formulaire précis, en ouvrir un autre créerait des éléments sans son estampille. `null`, donc pas
 * de bouton — `FinderField` le signale en développement.
 *
 * `null` aussi quand il n'y a rien à créer (une personne ne se crée pas depuis un formulaire).
 */
export function resolveFinderAddNewModal(
  mapping: Record<string, unknown> | undefined,
  fieldName: string | undefined,
  type: string,
  costumForms?: Record<string, CostumFormRef | undefined>,
): string | null {
  const declaration = finderAddNewDeclaration(mapping, fieldName, type);
  if (!declaration) {
    const standard = STANDARD_ADD_MODAL_BY_TYPE[type];
    return typeof standard === "string" ? standard : null;
  }
  const { value } = declaration;
  return typeof value === "string" && isOpenableAddModal(value, costumForms) ? value : null;
}

/**
 * L'élément qu'on vient de créer, sous la forme que range le finder.
 *
 * Le type vient de l'entité (`getEntityType`) et non de `serverData` : sur une organisation, `type`
 * y désigne sa nature (`Cooperative`, `NGO`…), pas sa collection.
 */
export function createdToFinderElement(entity: EntityTypes): FinderElement {
  const collection = entity.getEntityType() as FinderElementType;
  const result = toFinderSearchResult(entity as SearchEntity, collection);
  return { id: result.id, name: result.name, type: collection, img: result.profilThumbImageUrl };
}
