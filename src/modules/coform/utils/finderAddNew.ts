import type { EntityTypes, SearchEntity } from "@communecter/cocolight-api-client";
import {
  STANDARD_ADD_MODAL_BY_TYPE,
  siteCostumAddModal,
  type CostumFormRef,
} from "@/modules/profil/components/add/addModals";
import type { FinderElement, FinderElementType } from "../types";
import { toFinderSearchResult } from "./toFinderSearchResult";

/**
 * La modale d'AJOUT qu'ouvre le bouton « Ajouter » d'un finder (réglage `addNew` du legacy).
 *
 * Le legacy ouvrait le formulaire du costum pour le type cherché (`costum.typeObj[type].dynFormCostum`).
 * Ici, par ordre :
 *  1. la QUESTION, déclarée par le site dans `coform.finderAddNew` (clé `finder<étape><id>`) — deux
 *     finders d'un même type peuvent vouloir deux formulaires ;
 *  2. le TYPE cherché, déclaré au même endroit ;
 *  3. le formulaire costum que le site déclare pour ce type, s'il est unique — la règle de l'« Ajouter »
 *     d'un profil et de l'admin (`siteCostumAddModal`) : d'où qu'on crée, la même décision ;
 *  4. la modale standard du type.
 * `null` : rien à créer (une personne ne se crée pas depuis un formulaire).
 */
export function resolveFinderAddNewModal(
  mapping: Record<string, string> | undefined,
  fieldName: string | undefined,
  type: string,
  site?: { costumForms?: Record<string, CostumFormRef | undefined>; siteSlug?: string },
): string | null {
  const parQuestion = fieldName ? mapping?.[fieldName] : undefined;
  if (typeof parQuestion === "string" && parQuestion !== "") return parQuestion;
  const parType = mapping?.[type];
  if (typeof parType === "string" && parType !== "") return parType;
  return siteCostumAddModal(type, site?.costumForms, site?.siteSlug) ?? STANDARD_ADD_MODAL_BY_TYPE[type] ?? null;
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
