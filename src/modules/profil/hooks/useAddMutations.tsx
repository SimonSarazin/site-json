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
 * Construit un objet address à partir des champs aplatis du formulaire
 * Retourne undefined si aucune donnée d'adresse n'est présente
 */
function buildAddressFromForm(data: {
  addressCountry?: string;
  addressLocality?: string;
  localityId?: string;
  postalCode?: string;
  streetAddress?: string;
  codeInsee?: string;
  level1?: string;
  level1Name?: string;
  level2?: string;
  level2Name?: string;
  level3?: string;
  level3Name?: string;
  level4?: string;
  level4Name?: string;
}) {
  // Vérifier si au moins un champ d'adresse est rempli
  const hasAddressData = data.addressCountry || data.addressLocality ||
    data.postalCode || data.streetAddress;

  if (!hasAddressData) {
    return undefined;
  }

  return {
    "@type": "PostalAddress",
    addressCountry: data.addressCountry || undefined,
    addressLocality: data.addressLocality || undefined,
    localityId: data.localityId || undefined,
    postalCode: data.postalCode || undefined,
    streetAddress: data.streetAddress || undefined,
    codeInsee: data.codeInsee || undefined,
    level1: data.level1 || undefined,
    level1Name: data.level1Name || undefined,
    level2: data.level2 || undefined,
    level2Name: data.level2Name || undefined,
    level3: data.level3 || undefined,
    level3Name: data.level3Name || undefined,
    level4: data.level4 || undefined,
    level4Name: data.level4Name || undefined,
  };
}

/**
 * Extrait les champs d'adresse des données du formulaire et les remplace par l'objet address
 */
function transformFormDataWithAddress<T extends Record<string, unknown>>(data: T): Omit<T,
  'addressCountry' | 'addressLocality' | 'localityId' | 'postalCode' | 'streetAddress' |
  'codeInsee' | 'level1' | 'level1Name' | 'level2' | 'level2Name' | 'level3' | 'level3Name' |
  'level4' | 'level4Name'
> & { address?: ReturnType<typeof buildAddressFromForm> } {
  const {
    addressCountry,
    addressLocality,
    localityId,
    postalCode,
    streetAddress,
    codeInsee,
    level1,
    level1Name,
    level2,
    level2Name,
    level3,
    level3Name,
    level4,
    level4Name,
    ...rest
  } = data;

  const address = buildAddressFromForm({
    addressCountry: addressCountry as string | undefined,
    addressLocality: addressLocality as string | undefined,
    localityId: localityId as string | undefined,
    postalCode: postalCode as string | undefined,
    streetAddress: streetAddress as string | undefined,
    codeInsee: codeInsee as string | undefined,
    level1: level1 as string | undefined,
    level1Name: level1Name as string | undefined,
    level2: level2 as string | undefined,
    level2Name: level2Name as string | undefined,
    level3: level3 as string | undefined,
    level3Name: level3Name as string | undefined,
    level4: level4 as string | undefined,
    level4Name: level4Name as string | undefined,
  });

  return {
    ...rest,
    ...(address ? { address } : {}),
  } as Omit<T,
    'addressCountry' | 'addressLocality' | 'localityId' | 'postalCode' | 'streetAddress' |
    'codeInsee' | 'level1' | 'level1Name' | 'level2' | 'level2Name' | 'level3' | 'level3Name' |
    'level4' | 'level4Name'
  > & { address?: ReturnType<typeof buildAddressFromForm> };
}

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
    invalidateQueries: targetEntity ? [QUERY_KEYS.USER_ORGANIZATIONS(targetEntity.slug)] : [],
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
      const projectData = { ...transformedData };
      if (entity?.id) {
        projectData.parent = {
          [entity.id]: {
            type: entity.getEntityType?.() || "organizations",
            name: entity.serverData?.name,
          },
        };
      }

      // Créer le projet via le SDK
      const project = await targetEntity.project(projectData);
      await project.save();

      return { project };
    },
    successKey: "toast.add.projectSuccess",
    errorKey: "toast.add.projectError",
    invalidateQueries: [
      ...(targetEntity ? [QUERY_KEYS.USER_PROJECTS(targetEntity.slug)] : []),
      ...(entity ? [QUERY_KEYS.ELEMENT_ABOUT(entity.slug)] : []),
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
        if (entity?.id) {
          eventData.organizer = {
            [entity.id]: {
              type: entity.getEntityType?.() || "organizations",
              name: entity.serverData?.name,
            },
          };
        } else if (me?.id) {
          eventData.organizer = {
            [me.id]: {
              type: "citoyens",
              name: me.serverData?.name,
            },
          };
        }
      }

      // Le parent est pour les sous-événements uniquement
      // Ne pas confondre avec organizer - on ne l'ajoute pas si non défini

      // Créer l'événement via le SDK
      const event = await targetEntity.event(eventData);
      await event.save();

      return { event };
    },
    successKey: "toast.add.eventSuccess",
    errorKey: "toast.add.eventError",
    invalidateQueries: [
      ...(targetEntity ? [QUERY_KEYS.USER_EVENTS(targetEntity.slug)] : []),
      ...(entity ? [QUERY_KEYS.ELEMENT_ABOUT(entity.slug)] : []),
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
      const poiData = { ...transformedData };
      if (entity?.id) {
        poiData.parent = {
          [entity.id]: {
            type: entity.getEntityType?.() || "organizations",
            name: entity.serverData?.name,
          },
        };
      }

      // Créer le POI via le SDK
      const poi = await targetEntity.poi(poiData);
      await poi.save();

      return { poi };
    },
    successKey: "toast.add.poiSuccess",
    errorKey: "toast.add.poiError",
    invalidateQueries: [
      ...(targetEntity ? [QUERY_KEYS.USER_POIS(targetEntity.slug)] : []),
      ...(entity ? [QUERY_KEYS.ELEMENT_ABOUT(entity.slug)] : []),
    ],
    onSuccessCallback: (data) => {
      // Rediriger vers le profil du nouveau POI
      if (data.poi.slug) {
        navigate(`/profil/${data.poi.slug}`);
      }
    },
  });
}
