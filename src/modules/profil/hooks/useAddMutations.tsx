import type { EntityTypes, Organization, Project, Event, Poi } from "@communecter/cocolight-api-client";
import { useMutationWithToast } from "./core";
import { QUERY_KEYS } from "../constants";
import { useCocolight } from "@/hooks/useCocolight";
import type {
  AddOrganizationFormData,
  AddProjectFormData,
  AddEventFormData,
  AddPoiFormData,
} from "../schemaForm";
import { useNavigate } from "react-router";
import {
  transformFormDataWithAddress,
  buildParentReference,
  buildOrganizerReference,
} from "./mutationUtils";

/**
 * Hook pour créer une nouvelle organisation
 *
 * @param entity - L'entité depuis laquelle créer (utilisateur connecté par défaut)
 *
 * @example
 * const { mutate, isPending } = useAddOrganization();
 * mutate({ name: "Mon orga", type: "NGO", role: "admin" });
 */
export function useAddOrganization(entity?: EntityTypes | null) {
  const { me } = useCocolight();
  const navigate = useNavigate();

  // Utiliser l'entité fournie ou me par défaut
  const targetEntity = entity || me;

  return useMutationWithToast<{ organization: Organization }, AddOrganizationFormData>({
    mutationFn: async (data) => {
      if (!targetEntity) {
        throw new Error("No entity provided");
      }

      // Transformer les données avec l'objet address
      const transformedData = transformFormDataWithAddress(data);

      // Créer l'organisation via le SDK
      const organization = await targetEntity.organization(transformedData);
      await organization.save();

      return { organization };
    },
    successKey: "toast.add.organizationSuccess",
    errorKey: "toast.add.organizationError",
    invalidateQueries: targetEntity ? [QUERY_KEYS.USER_ORGANIZATIONS_PREFIX(targetEntity.slug)] : [],
    onSuccessCallback: (data) => {
      // Rediriger vers le profil de la nouvelle organisation
      if (data.organization.slug) {
        navigate(`/profil/${data.organization.slug}`);
      }
    },
  });
}

/**
 * Hook pour créer un nouveau projet
 *
 * @param entity - L'entité depuis laquelle créer (organization, user)
 *
 * @example
 * const { mutate, isPending } = useAddProject(organization);
 * mutate({ name: "Mon projet" });
 */
export function useAddProject(entity?: EntityTypes | null) {
  const { me } = useCocolight();
  const navigate = useNavigate();

  // Utiliser l'entité fournie ou me par défaut
  const targetEntity = entity || me;

  return useMutationWithToast<{ project: Project }, AddProjectFormData>({
    mutationFn: async (data) => {
      if (!targetEntity) {
        throw new Error("No entity provided");
      }

      // Transformer les données avec l'objet address
      const transformedData = transformFormDataWithAddress(data);

      // Ajouter le parent si on crée depuis une entité parente
      const parent = buildParentReference(entity);
      const projectData = {
        ...transformedData,
        ...(parent ? { parent } : {}),
      };

      // Créer le projet via le SDK
      const project = await targetEntity.project(projectData);
      await project.save();

      return { project };
    },
    successKey: "toast.add.projectSuccess",
    errorKey: "toast.add.projectError",
    invalidateQueries: [
      ...(targetEntity ? [QUERY_KEYS.USER_PROJECTS_PREFIX(targetEntity.slug)] : []),
      ...(entity ? [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)] : []),
    ],
    onSuccessCallback: (data) => {
      // Rediriger vers le profil du nouveau projet
      if (data.project.slug) {
        navigate(`/profil/${data.project.slug}`);
      }
    },
  });
}

/**
 * Hook pour créer un nouvel événement
 *
 * @param entity - L'entité depuis laquelle créer (organization, project, user)
 *
 * @example
 * const { mutate, isPending } = useAddEvent(organization);
 * mutate({ name: "Mon événement", type: "meeting", startDate: "...", endDate: "..." });
 */
export function useAddEvent(entity?: EntityTypes | null) {
  const { me } = useCocolight();
  const navigate = useNavigate();

  // Utiliser l'entité fournie ou me par défaut
  const targetEntity = entity || me;

  return useMutationWithToast<{ event: Event }, AddEventFormData>({
    mutationFn: async (data) => {
      if (!targetEntity) {
        throw new Error("No entity provided");
      }

      // Transformer les données avec l'objet address
      const transformedData = transformFormDataWithAddress(data);

      // Construire les données de l'événement
      const eventData = { ...transformedData };

      // L'organizer est obligatoire - utiliser l'entité fournie ou l'utilisateur
      if (!eventData.organizer || Object.keys(eventData.organizer).length === 0) {
        const organizer = buildOrganizerReference(entity, me);
        if (organizer) {
          eventData.organizer = organizer;
        }
      }

      // Créer l'événement via le SDK
      const event = await targetEntity.event(eventData);
      await event.save();

      return { event };
    },
    successKey: "toast.add.eventSuccess",
    errorKey: "toast.add.eventError",
    invalidateQueries: [
      ...(targetEntity ? [QUERY_KEYS.USER_EVENTS_PREFIX(targetEntity.slug)] : []),
      ...(entity ? [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)] : []),
    ],
    onSuccessCallback: (data) => {
      // Rediriger vers le profil du nouvel événement
      if (data.event.slug) {
        navigate(`/profil/${data.event.slug}`);
      }
    },
  });
}

/**
 * Hook pour créer un nouveau POI (Point d'Intérêt)
 *
 * @param entity - L'entité depuis laquelle créer (organization, project, event)
 *
 * @example
 * const { mutate, isPending } = useAddPoi(organization);
 * mutate({ name: "Mon POI", type: "place" });
 */
export function useAddPoi(entity?: EntityTypes | null) {
  const { me } = useCocolight();
  const navigate = useNavigate();

  // Utiliser l'entité fournie ou me par défaut
  const targetEntity = entity || me;

  return useMutationWithToast<{ poi: Poi }, AddPoiFormData>({
    mutationFn: async (data) => {
      if (!targetEntity) {
        throw new Error("No entity provided");
      }

      // Transformer les données avec l'objet address
      const transformedData = transformFormDataWithAddress(data);

      // Ajouter le parent si on crée depuis une entité parente
      const parent = buildParentReference(entity);
      const poiData = {
        ...transformedData,
        ...(parent ? { parent } : {}),
      };

      // Créer le POI via le SDK
      const poi = await targetEntity.poi(poiData);
      await poi.save();

      return { poi };
    },
    successKey: "toast.add.poiSuccess",
    errorKey: "toast.add.poiError",
    invalidateQueries: [
      ...(targetEntity ? [QUERY_KEYS.USER_POIS_PREFIX(targetEntity.slug)] : []),
      ...(entity ? [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)] : []),
    ],
    onSuccessCallback: (data) => {
      // Rediriger vers le profil du nouveau POI
      if (data.poi.slug) {
        navigate(`/profil/${data.poi.slug}`);
      }
    },
  });
}
