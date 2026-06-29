/**
 * Configs des modales d'AJOUT standard (poi / projet / organisation / événement) pour `EntityFormModal` —
 * remplacent `AddEntityGenericModals.tsx`. 100 % données + closures (defaults/spec/fieldProps/slots).
 */
import type { EntityTypes } from "@communecter/cocolight-api-client";
import type { FieldValues } from "react-hook-form";
import type { QueryKey } from "@tanstack/react-query";
import { PROFIL_QUERY_KEYS } from "../../constants";
import { SEARCH_QUERY_KEYS } from "@/modules/search/constants";
import { AGENDA_QUERY_KEYS } from "@/modules/agenda/constants/queryKeys";
import { ParentInfoReadonly } from "../../components/profile-edit/fields";
import { addPoiDescriptor } from "../addPoi.descriptor";
import { MERGED_ADD_PROJECT, MERGED_ADD_ORGANIZATION, buildMergedAddEvent } from "../profilMerged";
import { buildPayload } from "@/modules/formEngine/engine/entityForm";
import type { EntityModalConfig } from "../EntityFormModal";

const tabsTexts = (t: (k: string) => string) => ({ next: "", previous: "", cancel: t("common.cancel") });
const parentSlot = (parent: EntityTypes | null | undefined, organizerLabelKey?: string) => ({
  parentInfo: <ParentInfoReadonly parent={parent ?? null} />,
  organizerInfo: <ParentInfoReadonly parent={parent ?? null} labelKey={organizerLabelKey} />,
});
const ADDR_EMPTY = { addressCountry: "", addressLocality: "", localityId: "", postalCode: "", streetAddress: "" };

// Listes de RECHERCHE (annuaire/carte) à rafraîchir après toute création/édition — préfixes FIXES
// (cf. SearchProStatic "searchCostumStatic"/"…MapAll", SearchPro "searchCostum"/"…MapAll", CardCount).
// Sans ça, la liste search (ex. /projets) reste périmée au retour : la mutation n'invalidait que les
// listes du PROFIL (USER_*_PREFIX), pas la query search. RESULTS_PREFIX = partial-match → toutes les
// variations de filtres ; invalidation niveau queryClient → persiste malgré le navigate post-création.
const SEARCH_LISTS_INVALIDATION: QueryKey[] = [
  SEARCH_QUERY_KEYS.RESULTS_PREFIX("searchCostumStatic"),
  SEARCH_QUERY_KEYS.RESULTS_PREFIX("searchCostumStaticMapAll"),
  SEARCH_QUERY_KEYS.RESULTS_PREFIX("searchCostum"),
  SEARCH_QUERY_KEYS.RESULTS_PREFIX("searchCostumMapAll"),
  SEARCH_QUERY_KEYS.RESULTS_PREFIX("cardCountCT"),
];

export const addPoiConfig: EntityModalConfig = {
  descriptor: addPoiDescriptor,
  title: { add: "AddEntity.modal.poi.title", edit: "AddEntity.modal.poi.title" },
  description: { add: "AddEntity.modal.poi.description" },
  texts: tabsTexts,
  buildDefaults: () => ({ name: "", type: "place", description: "", tags: [], ...ADDR_EMPTY }) as FieldValues,
  slots: ({ parent }) => parentSlot(parent),
  buildSpec: ({ parent, me }) => {
    const target = parent ?? me;
    return {
      mode: "add", entityType: "poi", target: parent ?? null,
      buildPayload: (d) => buildPayload({ descriptor: addPoiDescriptor }, d), // pipeline générique direct (comme les costums)
      inject: { parent: parent ?? null },
      successKey: "toast.add.poiSuccess", errorKey: "toast.add.poiError", errorContext: "EntityFormModal · ADD_POI",
      invalidateQueries: [
        ...(target ? [PROFIL_QUERY_KEYS.USER_POIS_PREFIX(target.slug)] : []),
        ...(parent ? [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(parent.slug)] : []),
        ...SEARCH_LISTS_INVALIDATION,
      ],
    };
  },
};

export const addProjectConfig: EntityModalConfig = {
  descriptor: MERGED_ADD_PROJECT, // descripteur unifié rendu+write (mergeRenderPipeline), comme les costums/poi
  title: { add: "AddEntity.modal.project.title", edit: "AddEntity.modal.project.title" },
  description: { add: "AddEntity.modal.project.description" },
  texts: tabsTexts,
  buildDefaults: () => ({
    name: "", shortDescription: "", public: true, url: "", tags: [],
    preferences: { isOpenData: false, isOpenEdition: false, crowdfunding: true }, ...ADDR_EMPTY,
  }) as FieldValues,
  slots: ({ parent }) => parentSlot(parent),
  buildSpec: ({ parent, me }) => {
    const target = parent ?? me;
    return {
      mode: "add", entityType: "projects", target: parent ?? null,
      buildPayload: (d) => buildPayload({ descriptor: MERGED_ADD_PROJECT }, d),
      inject: { role: true, parent: parent ?? null },
      successKey: "toast.add.projectSuccess", errorKey: "toast.add.projectError", errorContext: "EntityFormModal · ADD_PROJECT",
      invalidateQueries: [
        ...(target ? [PROFIL_QUERY_KEYS.USER_PROJECTS_PREFIX(target.slug)] : []),
        ...(parent ? [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(parent.slug)] : []),
        ...SEARCH_LISTS_INVALIDATION,
      ],
    };
  },
};

export const addOrganizationConfig: EntityModalConfig = {
  descriptor: MERGED_ADD_ORGANIZATION, // descripteur unifié rendu+write (mergeRenderPipeline), comme les costums/poi
  title: { add: "AddEntity.modal.organization.title", edit: "AddEntity.modal.organization.title" },
  description: { add: "AddEntity.modal.organization.description" },
  texts: tabsTexts,
  buildDefaults: () => ({
    name: "", type: "NGO", role: "admin", shortDescription: "", email: undefined, url: "", tags: [], ...ADDR_EMPTY,
  }) as FieldValues,
  slots: ({ parent }) => parentSlot(parent),
  buildSpec: ({ parent, me }) => {
    const target = parent ?? me;
    return {
      mode: "add", entityType: "organizations", target: parent ?? null,
      buildPayload: (d) => buildPayload({ descriptor: MERGED_ADD_ORGANIZATION }, d),
      inject: { role: true, dropEmptyEmail: true },
      successKey: "toast.add.organizationSuccess", errorKey: "toast.add.organizationError", errorContext: "EntityFormModal · ADD_ORGANIZATION",
      invalidateQueries: [
        ...(target ? [PROFIL_QUERY_KEYS.USER_ORGANIZATIONS_PREFIX(target.slug)] : []),
        ...SEARCH_LISTS_INVALIDATION,
      ],
    };
  },
};

export const addEventConfig: EntityModalConfig = {
  // Descripteur factory unifié rendu+write : validation organizer dépend de la présence d'un parent.
  descriptor: ({ parent }) => buildMergedAddEvent(Boolean(parent)),
  title: { add: "AddEntity.modal.event.title", edit: "AddEntity.modal.event.title" },
  description: { add: "AddEntity.modal.event.description" },
  texts: tabsTexts,
  buildDefaults: ({ parent }) => ({
    name: "", type: "meeting", shortDescription: "", url: "", tags: [], public: true,
    recurrency: false, startDate: undefined, endDate: undefined, openingHours: undefined,
    organizer: parent?.id
      ? { [parent.id]: { type: parent.getEntityType?.() || "organizations", name: parent.serverData?.name } }
      : undefined,
    ...ADDR_EMPTY, parent: undefined,
    _hasParent: Boolean(parent), // lu par la clé de validate "validate:eventAdd"
  }) as FieldValues,
  // Filtre runtime du finder sous-événement : events organisés par le parent.
  buildFieldProps: ({ parent }) =>
    parent?.id ? { parent: { filters: { filters: { [`organizer.${parent.id}`]: { $exists: true } } } } } : undefined,
  slots: ({ parent }) => parentSlot(parent, "ProfileEdit.fields.organizer.label"),
  buildSpec: ({ parent, me }) => {
    const target = parent ?? me;
    return {
      mode: "add", entityType: "events", target: parent ?? null,
      buildPayload: (d) => buildPayload({ descriptor: buildMergedAddEvent(Boolean(parent)) }, d),
      inject: { role: true, parent: parent ?? null, organizerFallback: parent ?? null },
      successKey: "toast.add.eventSuccess", errorKey: "toast.add.eventError", errorContext: "EntityFormModal · ADD_EVENT",
      invalidateQueries: [
        ...(target ? [PROFIL_QUERY_KEYS.USER_EVENTS_PREFIX(target.slug)] : []),
        ...(parent ? [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(parent.slug)] : []),
        ...SEARCH_LISTS_INVALIDATION,
        // Un event s'affiche aussi dans le module agenda (clés propres) → on rafraîchit calendrier + liste.
        AGENDA_QUERY_KEYS.CALENDAR_PREFIX(),
        AGENDA_QUERY_KEYS.LIST_PREFIX(),
      ],
    };
  },
};
