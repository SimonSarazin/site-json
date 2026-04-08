import type { EntityTypes, Organization, Project, Event, Poi } from "@communecter/cocolight-api-client";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { QUERY_KEYS } from "../constants";
import { useCocolight } from "@/hooks/useCocolight";
import type {
  AddOrganizationFormData,
  AddProjectFormData,
  AddEventFormData,
  AddPoiFormData,
  AddTransparentCommuneFormData,
} from "../schemaForm";
import { useNavigate } from "react-router";
import {
  transformFormDataWithAddress,
  buildParentReference,
  buildOrganizerReference,
} from "./mutationUtils";
import { toast } from "sonner";
import { ALL_THEME } from "@/modules/search/schema";

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
    namespace: "modules/profil",
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

export function useAddTransparentCommune(datas?: EntityTypes | null) {
  const { me } = useCocolight();
  const navigate = useNavigate();

  const targetEntity = datas || me;
  
  return useMutationWithToast<{ organization: Organization }, AddTransparentCommuneFormData>({
    mutationFn: async (data) => {
      if (!targetEntity) {
        throw new Error("No entity provided");
      }

      const { bannerImageUrl, bannerLogoUrl, bannerText, selectedThematics, ...rest } = data;
      const organizationData: AddOrganizationFormData = {
        ...rest,
        type: "NGO",
      };

      const transformedData = transformFormDataWithAddress(organizationData);
      const organization = await targetEntity.organization(transformedData);

      const costumPayload: Record<string, unknown> = {
        transparentCommune: true,
        cocity: true,
        slug: "costumize",
        typeCocity: "ville",
      };

      if (bannerImageUrl) {
        costumPayload.bannerImageUrl = bannerImageUrl;
      }
      if (bannerLogoUrl) {
        costumPayload.bannerLogoUrl = bannerLogoUrl;
      }
      if (bannerText) {
        costumPayload.bannerText = bannerText;
      }
      const thematic = (selectedThematics ?? []).filter((key) => key in ALL_THEME);
      const filiere = thematic.reduce<Record<string, { name: string; icon: string; tags: string[] }>>((acc, key) => {
        acc[key] = ALL_THEME[key];
        return acc;
      }, {});
      const hasFiliere = Object.keys(filiere).length > 0;

      // Persist transparent commune specific metadata on the organization profile
      organization.data.costum = {
        ...(organization.data.costum as Record<string, unknown> | undefined),
        ...costumPayload,
      };

      organization.data.thematic = thematic;
      if (hasFiliere) {
        organization.data.filiere = filiere;
      }

      await organization.save();

      return { organization };
    },
    namespace: "modules/profil",
    successKey: "toast.add.organizationSuccess",
    errorKey: "toast.add.organizationError",
    invalidateQueries: targetEntity ? [QUERY_KEYS.USER_ORGANIZATIONS_PREFIX(targetEntity.slug)] : [],
    onSuccessCallback: (data) => {
      if (data.organization.slug) {
        navigate(`/profil/${data.organization.slug}`);
        toast.success("Votre Commune Transarente est créée avec succès !", {
          description: "Veuillez copier ce slug pour configurer votre domaine personnalisé : " + data.organization.slug + "",
        });
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
    namespace: "modules/profil",
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

      // Type avec les dates converties en objets Date
      type EventDataWithDates = Omit<typeof transformedData, 'startDate' | 'endDate'> & {
        startDate?: Date;
        endDate?: Date;
        organizer?: ReturnType<typeof buildOrganizerReference>;
      };

      // Construire les données de l'événement avec les dates converties
      const eventData: EventDataWithDates = {
        ...transformedData,
        startDate: transformedData.startDate ? new Date(transformedData.startDate) : undefined,
        endDate: transformedData.endDate ? new Date(transformedData.endDate) : undefined,
      };

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
    namespace: "modules/profil",
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
    namespace: "modules/profil",
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
