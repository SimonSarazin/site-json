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

/**
 * Hook pour créer une nouvelle organisation
 *
 * @example
 * const { mutate, isPending } = useAddOrganization();
 * mutate({ name: "Mon orga", type: "NGO", role: "admin" });
 */
export function useAddOrganization() {
  const { me } = useCocolight();
  const navigate = useNavigate();

  return useMutationWithToast<{ organization: Organization }, AddOrganizationFormData>({
    mutationFn: async (data) => {
      if (!me) {
        throw new Error("User not connected");
      }

      // Créer l'organisation via le SDK
      const organization = await me.organization(data);
      await organization.save();

      return { organization };
    },
    successKey: "toast.add.organizationSuccess",
    errorKey: "toast.add.organizationError",
    invalidateQueries: me ? [QUERY_KEYS.USER_ORGANIZATIONS(me.slug)] : [],
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
 * @param parentEntity - L'entité parente optionnelle (organization, user)
 *
 * @example
 * const { mutate, isPending } = useAddProject(organization);
 * mutate({ name: "Mon projet" });
 */
export function useAddProject(parentEntity?: EntityTypes | null) {
  const { me } = useCocolight();
  const navigate = useNavigate();

  return useMutationWithToast<{ project: Project }, AddProjectFormData>({
    mutationFn: async (data) => {
      if (!me) {
        throw new Error("User not connected");
      }

      // Ajouter le parent si fourni
      const projectData = { ...data };
      if (parentEntity?.id) {
        projectData.parent = {
          [parentEntity.id]: {
            type: parentEntity.getEntityType?.() || "organizations",
            name: parentEntity.serverData?.name,
          },
        };
      }

      // Créer le projet via le SDK
      const project = await me.project(projectData);
      await project.save();

      return { project };
    },
    successKey: "toast.add.projectSuccess",
    errorKey: "toast.add.projectError",
    invalidateQueries: [
      ...(me ? [QUERY_KEYS.USER_PROJECTS(me.slug)] : []),
      ...(parentEntity ? [QUERY_KEYS.ELEMENT_ABOUT(parentEntity.slug)] : []),
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
 * @param parentEntity - L'entité parente (organization, project, user) - organizer obligatoire
 *
 * @example
 * const { mutate, isPending } = useAddEvent(organization);
 * mutate({ name: "Mon événement", type: "meeting", startDate: "...", endDate: "..." });
 */
export function useAddEvent(parentEntity?: EntityTypes | null) {
  const { me } = useCocolight();
  const navigate = useNavigate();

  return useMutationWithToast<{ event: Event }, AddEventFormData>({
    mutationFn: async (data) => {
      if (!me) {
        throw new Error("User not connected");
      }

      // Construire les données de l'événement
      const eventData = { ...data };

      // L'organizer est obligatoire - utiliser le parent ou l'utilisateur
      if (!eventData.organizer || Object.keys(eventData.organizer).length === 0) {
        if (parentEntity?.id) {
          eventData.organizer = {
            [parentEntity.id]: {
              type: parentEntity.getEntityType?.() || "organizations",
              name: parentEntity.serverData?.name,
            },
          };
        } else if (me.id) {
          eventData.organizer = {
            [me.id]: {
              type: "citoyens",
              name: me.serverData?.name,
            },
          };
        }
      }

      // Ajouter le parent si différent de l'organizer
      if (parentEntity?.id && !eventData.parent) {
        eventData.parent = {
          [parentEntity.id]: {
            type: parentEntity.getEntityType?.() || "organizations",
            name: parentEntity.serverData?.name,
          },
        };
      }

      // Créer l'événement via le SDK
      const event = await me.event(eventData);
      await event.save();

      return { event };
    },
    successKey: "toast.add.eventSuccess",
    errorKey: "toast.add.eventError",
    invalidateQueries: [
      ...(me ? [QUERY_KEYS.USER_EVENTS(me.slug)] : []),
      ...(parentEntity ? [QUERY_KEYS.ELEMENT_ABOUT(parentEntity.slug)] : []),
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
 * @param parentEntity - L'entité parente optionnelle (organization, project, event)
 *
 * @example
 * const { mutate, isPending } = useAddPoi(organization);
 * mutate({ name: "Mon POI", type: "place" });
 */
export function useAddPoi(parentEntity?: EntityTypes | null) {
  const { me } = useCocolight();
  const navigate = useNavigate();

  return useMutationWithToast<{ poi: Poi }, AddPoiFormData>({
    mutationFn: async (data) => {
      if (!me) {
        throw new Error("User not connected");
      }

      // Ajouter le parent si fourni
      const poiData = { ...data };
      if (parentEntity?.id) {
        poiData.parent = {
          [parentEntity.id]: {
            type: parentEntity.getEntityType?.() || "organizations",
            name: parentEntity.serverData?.name,
          },
        };
      }

      // Créer le POI via le SDK
      const poi = await me.poi(poiData);
      await poi.save();

      return { poi };
    },
    successKey: "toast.add.poiSuccess",
    errorKey: "toast.add.poiError",
    invalidateQueries: [
      ...(me ? [QUERY_KEYS.USER_POIS(me.slug)] : []),
      ...(parentEntity ? [QUERY_KEYS.ELEMENT_ABOUT(parentEntity.slug)] : []),
    ],
    onSuccessCallback: (data) => {
      // Rediriger vers le profil du nouveau POI
      if (data.poi.slug) {
        navigate(`/profil/${data.poi.slug}`);
      }
    },
  });
}
