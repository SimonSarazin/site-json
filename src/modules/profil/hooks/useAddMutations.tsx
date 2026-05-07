import type { EntityTypes, Organization, Project, Event, Poi } from "@communecter/cocolight-api-client";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
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

const TIERS_LIEU_COSTUM = {
  costumSlug: "navigatorDesTierslieux",
  costumEditMode: false,
  costumId: "649ed498f93ee7202e6c8b12",
  costumType: "projects",
  mainTag: "TiersLieux",
  compagnon: "Compagnon France Tiers-Lieux",
} as const;

interface AddTiersLieuFormData {
  name: string;
  openingMonth?: string;
  openingYear?: string;
  shortDescription?: string;
  structureName?: string;
  managementType?: string;
  managementTypeOther?: string;
  family?: string[];
  familyOther?: string;
  surfaceBuilt?: string;
  surfaceOutdoor?: string;
  // Adresse
  addressCountry?: string;
  addressLocality?: string;
  postalCode?: string;
  streetAddress?: string;
  localityId?: string;
  // Médias
  logo?: string;
  photos?: string[];
  videoUrl?: string;
  // Présence en ligne
  websiteUrl?: string;
  socialLinks?: Array<{ platform: string; url: string }>;
  // Horaires
  hours?: Record<string, { enabled: boolean; start: string; end: string }>;
  // Contact
  email: string;
  phone?: string;
  // Description
  description?: string;
}

const DAY_TO_DOW: Record<string, string> = {
  monday: "Mo",
  tuesday: "Tu",
  wednesday: "We",
  thursday: "Th",
  friday: "Fr",
  saturday: "Sa",
  sunday: "Su",
};

function buildOpeningHoursPayload(hours?: AddTiersLieuFormData["hours"]) {
  if (!hours) return [];
  return Object.entries(hours)
    .filter(([, h]) => h.enabled)
    .map(([day, h]) => ({
      dayOfWeek: DAY_TO_DOW[day] ?? day,
      hours: [{ opens: h.start, closes: h.end }],
    }));
}

function buildOpeningDatePayload(month?: string, year?: string): string | undefined {
  if (!month && !year) return undefined;
  if (month && year) return `01/${month}/${year}`;
  return month || year;
}


export function useAddTiersLieu(entity?: EntityTypes | null) {
  const { me } = useCocolight();
  const navigate = useNavigate();
  const targetEntity = entity || me;

  return useMutationWithToast<{ organization: Organization }, AddTiersLieuFormData>({
    mutationFn: async (data) => {
      if (!targetEntity) {
        throw new Error("No entity provided");
      }

      // Construire le payload backend (forme attendue par /co2/element/save)
      const transformedAddress = transformFormDataWithAddress({
        addressCountry: data.addressCountry,
        addressLocality: data.addressLocality,
        postalCode: data.postalCode,
        streetAddress: data.streetAddress,
        localityId: data.localityId,
      });

      // ID en dur pour reproduire le test Postman
      const generatedId = "69f858c451e74c3967050385";

      const payload: Record<string, unknown> = {
        // Champs requis par le schéma AJV ADD_TIERS_LIEU (permissif)
        id: generatedId,
        collection: "organizations",
        key: "organization",
        name: data.name,
        role: "admin",
        ...transformedAddress,
        // Description / contenu
        ...(data.shortDescription ? { shortDescription: data.shortDescription } : {}),
        ...(data.description ? { description: data.description } : {}),
        // Champs custom navigatorDesTierslieux
        ...(buildOpeningDatePayload(data.openingMonth, data.openingYear)
          ? { openingDate: buildOpeningDatePayload(data.openingMonth, data.openingYear) }
          : {}),
        ...(data.structureName ? { holderOrganization: data.structureName } : {}),
        ...(data.managementType
          ? { manageModel: data.managementType === "autre" && data.managementTypeOther ? data.managementTypeOther : data.managementType }
          : {}),
        ...(data.family && data.family.length > 0
          ? { typePlace: data.family.join(", ") }
          : {}),
        ...(data.familyOther ? { typePlaceOther: data.familyOther } : {}),
        ...(data.surfaceBuilt ? { buildingSurfaceArea: Number(data.surfaceBuilt) } : {}),
        ...(data.surfaceOutdoor ? { siteSurfaceArea: Number(data.surfaceOutdoor) } : {}),
        // Médias
        ...(data.logo ? { profilImageUrl: data.logo } : {}),
        ...(data.photos && data.photos.length > 0 ? { photos: data.photos } : {}),
        ...(data.videoUrl ? { video: [data.videoUrl] } : {}),
        // Site web + réseaux
        ...(data.websiteUrl ? { url: data.websiteUrl } : {}),
        ...(data.socialLinks && data.socialLinks.length > 0
          ? {
              socialNetwork: data.socialLinks.filter((s) => s.platform && s.url),
            }
          : {}),
        // Contact
        email: data.email,
        ...(data.phone ? { telephone: data.phone } : {}),
        // Horaires
        ...((() => {
          const oh = buildOpeningHoursPayload(data.hours);
          return oh.length > 0 ? { openingHours: oh } : {};
        })()),
        // Constantes navigatorDesTierslieux
        mainTag: TIERS_LIEU_COSTUM.mainTag,
        compagnon: TIERS_LIEU_COSTUM.compagnon,
        preferences: {
          isOpenData: true,
          isOpenEdition: true,
        },
        source: {
          insertOrign: "costum",
          keys: [TIERS_LIEU_COSTUM.costumSlug],
          key: TIERS_LIEU_COSTUM.costumSlug,
        },
        costumSlug: TIERS_LIEU_COSTUM.costumSlug,
        costumEditMode: TIERS_LIEU_COSTUM.costumEditMode,
        costumId: TIERS_LIEU_COSTUM.costumId,
        costumType: TIERS_LIEU_COSTUM.costumType,
      };

      const targetWithEndpoint = targetEntity as unknown as {
        endpointApi: { addTiersLieu: (data: Record<string, unknown>) => Promise<unknown> };
      };
      await targetWithEndpoint.endpointApi.addTiersLieu(payload);

      const organization = await targetEntity.organization({ id: generatedId }) as Organization;

      return { organization };
    },
    namespace: "modules/profil",
    successKey: "AddTiersLieux.toast.success",
    errorKey: "AddTiersLieux.toast.error",
    invalidateQueries: targetEntity ? [QUERY_KEYS.USER_ORGANIZATIONS_PREFIX(targetEntity.slug)] : [],
    onSuccessCallback: (data) => {
      if (data.organization.slug) {
        navigate(`/profil/${data.organization.slug}`);
      }
    },
  });
}
