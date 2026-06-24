/**
 * Configs des modales d'AJOUT standard (poi / projet / organisation / événement) pour `EntityFormModal` —
 * remplacent `AddEntityGenericModals.tsx`. 100 % données + closures (defaults/spec/fieldProps/slots).
 */
import type { EntityTypes } from "@communecter/cocolight-api-client";
import type { FieldValues } from "react-hook-form";
import { PROFIL_QUERY_KEYS } from "../../constants";
import { ParentInfoReadonly } from "../../components/profile-edit/fields";
import { addPoiDescriptor } from "../addPoi.descriptor";
import { addProjectDescriptor } from "../addProject.descriptor";
import { addOrganizationDescriptor } from "../addOrganization.descriptor";
import { buildAddEventDescriptor } from "../addEvent.descriptor";
import { buildProfileUpdateData } from "../editProfilePayload";
import { buildAddPoiPayload } from "../costum/poiEquipement/fns";
import type { AddPoiFormData } from "../../schemaForm";
import type { EntityModalConfig } from "../EntityFormModal";

const tabsTexts = (t: (k: string) => string) => ({ next: "", previous: "", cancel: t("common.cancel") });
const parentSlot = (parent: EntityTypes | null | undefined, organizerLabelKey?: string) => ({
  parentInfo: <ParentInfoReadonly parent={parent ?? null} />,
  organizerInfo: <ParentInfoReadonly parent={parent ?? null} labelKey={organizerLabelKey} />,
});
const ADDR_EMPTY = { addressCountry: "", addressLocality: "", localityId: "", postalCode: "", streetAddress: "" };

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
      buildPayload: (d) => buildAddPoiPayload(d as unknown as AddPoiFormData) as Record<string, unknown>,
      inject: { parent: parent ?? null },
      successKey: "toast.add.poiSuccess", errorKey: "toast.add.poiError", errorContext: "EntityFormModal · ADD_POI",
      invalidateQueries: [
        ...(target ? [PROFIL_QUERY_KEYS.USER_POIS_PREFIX(target.slug)] : []),
        ...(parent ? [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(parent.slug)] : []),
      ],
    };
  },
};

export const addProjectConfig: EntityModalConfig = {
  descriptor: addProjectDescriptor,
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
      buildPayload: (d) => buildProfileUpdateData("projects", d),
      inject: { role: true, parent: parent ?? null },
      successKey: "toast.add.projectSuccess", errorKey: "toast.add.projectError", errorContext: "EntityFormModal · ADD_PROJECT",
      invalidateQueries: [
        ...(target ? [PROFIL_QUERY_KEYS.USER_PROJECTS_PREFIX(target.slug)] : []),
        ...(parent ? [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(parent.slug)] : []),
      ],
    };
  },
};

export const addOrganizationConfig: EntityModalConfig = {
  descriptor: addOrganizationDescriptor,
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
      buildPayload: (d) => buildProfileUpdateData("organizations", d),
      inject: { role: true, dropEmptyEmail: true },
      successKey: "toast.add.organizationSuccess", errorKey: "toast.add.organizationError", errorContext: "EntityFormModal · ADD_ORGANIZATION",
      invalidateQueries: target ? [PROFIL_QUERY_KEYS.USER_ORGANIZATIONS_PREFIX(target.slug)] : [],
    };
  },
};

export const addEventConfig: EntityModalConfig = {
  // Descripteur factory : validation organizer dépend de la présence d'un parent.
  descriptor: ({ parent }) => buildAddEventDescriptor(Boolean(parent)),
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
    _hasParent: Boolean(parent), // lu par la clé de validate "addEventValid"
  }) as FieldValues,
  // Filtre runtime du finder sous-événement : events organisés par le parent.
  buildFieldProps: ({ parent }) =>
    parent?.id ? { parent: { filters: { filters: { [`organizer.${parent.id}`]: { $exists: true } } } } } : undefined,
  slots: ({ parent }) => parentSlot(parent, "ProfileEdit.fields.organizer.label"),
  buildSpec: ({ parent, me }) => {
    const target = parent ?? me;
    return {
      mode: "add", entityType: "events", target: parent ?? null,
      buildPayload: (d) => buildProfileUpdateData("events", d),
      inject: { role: true, parent: parent ?? null, organizerFallback: parent ?? null },
      successKey: "toast.add.eventSuccess", errorKey: "toast.add.eventError", errorContext: "EntityFormModal · ADD_EVENT",
      invalidateQueries: [
        ...(target ? [PROFIL_QUERY_KEYS.USER_EVENTS_PREFIX(target.slug)] : []),
        ...(parent ? [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(parent.slug)] : []),
      ],
    };
  },
};
