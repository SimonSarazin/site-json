/**
 * Descripteurs PROFIL UNIFIÉS (rendu + read/write) — DÉRIVÉS au runtime via `mergeRenderPipeline`
 * (descripteur de RENDU add/edit + pipeline PARTAGÉ `PROFIL_DESCRIPTORS`). UN seul objet pilote
 * rendu + READ + WRITE par (formulaire, type) — comme les costums/poi — SANS dupliquer le pipeline :
 * les sources `EDIT_DESCRIPTORS` (rendu, add/edit différents) et `PROFIL_DESCRIPTORS` (pipeline) restent DRY.
 *
 * Parité byte garantie PAR CONSTRUCTION (les `renderOnly` sont ignorés par seedFromEntity/valuesToPayload →
 * l'ensemble lu/écrit du fusionné = celui du pipeline) et PROUVÉE par `profilDerived.configDriven.test`
 * (`seedEntity`/`buildPayload` du fusionné === `seedProfileFormValues`/`buildProfileUpdateData` live, add ET edit).
 *
 * NB poi-ADD : NON inclus — `addPoiDescriptor` est déjà son propre descripteur unifié, avec un writer
 * d'adresse DIFFÉRENT du pipeline profil (`address:write` gate "any" vs `pf:addressWrite` gate
 * "countryLocality"). Le re-fusionner changerait le gate de création → divergence assumée add/edit conservée.
 */
import type { FormDescriptor } from "@/modules/formEngine";
import { mergeRenderPipeline } from "@/modules/formEngine/config/mergeRenderPipeline";
import { EDIT_DESCRIPTORS } from "./editProfile.descriptor";
import { addProjectDescriptor } from "./addProject.descriptor";
import { addOrganizationDescriptor } from "./addOrganization.descriptor";
import { buildAddEventDescriptor } from "./addEvent.descriptor";
import { PROFIL_DESCRIPTORS } from "./editProfilePayload";

/** ÉDITION : descripteur unifié rendu+read+write par type (citoyens/organizations/projects/events/poi). */
export const MERGED_EDIT_DESCRIPTORS: Record<string, FormDescriptor> = Object.fromEntries(
  Object.keys(EDIT_DESCRIPTORS).map((t) => [t, mergeRenderPipeline(EDIT_DESCRIPTORS[t], PROFIL_DESCRIPTORS[t])]),
);

/** AJOUT (rendu add ≠ edit) : org/project unifiés. event = factory (validate dépend de la présence d'un parent). */
export const MERGED_ADD_PROJECT = mergeRenderPipeline(addProjectDescriptor, PROFIL_DESCRIPTORS.projects);
export const MERGED_ADD_ORGANIZATION = mergeRenderPipeline(addOrganizationDescriptor, PROFIL_DESCRIPTORS.organizations);
export const buildMergedAddEvent = (hasParent: boolean): FormDescriptor =>
  mergeRenderPipeline(buildAddEventDescriptor(hasParent), PROFIL_DESCRIPTORS.events);
