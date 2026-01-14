import { useMemo } from "react";
import type { EntityTypes, SocialNetworkPayload, PostalAddress } from "@communecter/cocolight-api-client";
import { isEvent, isOrganization, isProject, isUser, isPoi } from "@/lib/getTypedEntity";
import { widgetFormatters } from "@/constants/DAYS";
import type {
  UserProfileFormData,
  OrganizationProfileFormData,
  ProjectProfileFormData,
  EventProfileFormData,
  PoiProfileFormData,
} from "../schemaForm";

// ============================================================================
// HELPERS - Extraction des champs répétitifs
// ============================================================================

/**
 * Extrait les 14 champs d'adresse depuis un objet PostalAddress
 */
function extractAddressFields(address: PostalAddress | undefined) {
  const addr = address ?? {};
  return {
    addressCountry: addr.addressCountry || "",
    streetAddress: addr.streetAddress || "",
    postalCode: addr.postalCode || "",
    addressLocality: addr.addressLocality || "",
    localityId: addr.localityId || "",
    level1: addr.level1 || "",
    level1Name: addr.level1Name || "",
    level2: addr.level2 || "",
    level2Name: addr.level2Name || "",
    level3: addr.level3 || "",
    level3Name: addr.level3Name || "",
    level4: addr.level4 || "",
    level4Name: addr.level4Name || "",
    codeInsee: addr.codeInsee || "",
  };
}

/**
 * Extrait les 9 champs de réseaux sociaux
 */
function extractSocialFields(socialNetwork: SocialNetworkPayload | undefined) {
  const sn = socialNetwork ?? {};
  return {
    github: sn.github || "",
    gitlab: sn.gitlab || "",
    facebook: sn.facebook || "",
    twitter: sn.twitter || "",
    instagram: sn.instagram || "",
    diaspora: sn.diaspora || "",
    mastodon: sn.mastodon || "",
    telegram: sn.telegram || "",
    signal: sn.signal || "",
  };
}

/**
 * Normalise les horaires d'ouverture avec le formatter
 */
function extractOpeningHours(openingHours: unknown) {
  return openingHours && Array.isArray(openingHours)
    ? widgetFormatters.openingHours(openingHours).filter((d: { hours: unknown[] }) => d.hours.length > 0)
    : [];
}

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

/**
 * Hook pour extraire les données d'un profil et les formater pour React Hook Form
 *
 * @param entity - L'entité dont on veut extraire les données
 * @returns Objet avec defaultValues pour le formulaire
 *
 * @example
 * const { defaultValues } = useProfileFormData(entity);
 * const form = useForm({ defaultValues });
 */
export function useProfileFormData(entity: EntityTypes | null) {
  return useMemo(() => {
    if (!entity || !entity.serverData) {
      return { defaultValues: null, entityType: null };
    }

    const entityType = entity.getEntityType();

    // User
    if (isUser(entity)) {
      const { serverData } = entity;

      const defaultValues: UserProfileFormData = {
        name: serverData.name || "",
        shortDescription: serverData.shortDescription || "",
        description: serverData.description || "",
        email: serverData.email || "",
        url: serverData.url || "",
        tags: serverData.tags || [],
        slug: serverData.slug || "",
        // Spécifique User
        mobile: serverData.mobile || "",
        fixe: serverData.fixe || "",
        birthDate: serverData.birthDate
          ? new Date(serverData.birthDate).toISOString().split('T')[0]
          : "",
        // Helpers
        ...extractAddressFields(serverData.address),
        ...extractSocialFields(serverData.socialNetwork),
      };

      return { defaultValues, entityType };
    }

    // Organization
    if (isOrganization(entity)) {
      const { serverData } = entity;

      const defaultValues: OrganizationProfileFormData = {
        name: serverData.name || "",
        shortDescription: serverData.shortDescription || "",
        description: serverData.description || "",
        email: serverData.email || "",
        url: serverData.url || "",
        type: serverData.type,
        tags: serverData.tags || [],
        slug: serverData.slug || "",
        // Spécifique Organization
        openingHours: extractOpeningHours(serverData.openingHours),
        // Helpers
        ...extractAddressFields(serverData.address),
        ...extractSocialFields(serverData.socialNetwork),
      };

      return { defaultValues, entityType };
    }

    // Project
    if (isProject(entity)) {
      const { serverData } = entity;

      const defaultValues: ProjectProfileFormData = {
        name: serverData.name || "",
        shortDescription: serverData.shortDescription || "",
        description: serverData.description || "",
        email: serverData.email || "",
        url: serverData.url || "",
        tags: serverData.tags || [],
        slug: serverData.slug || "",
        // Spécifique Project
        avancement: serverData.avancement,
        parent: serverData.parent ?? undefined,
        // Helpers
        ...extractAddressFields(serverData.address),
        ...extractSocialFields(serverData.socialNetwork),
      };

      return { defaultValues, entityType };
    }

    // Event (pas de socialNetwork, pas de description)
    if (isEvent(entity)) {
      const { serverData } = entity;

      const defaultValues: EventProfileFormData = {
        name: serverData.name || "",
        shortDescription: serverData.shortDescription || "",
        email: serverData.email || "",
        url: serverData.url || "",
        type: serverData.type,
        tags: serverData.tags || [],
        slug: serverData.slug || "",
        // Spécifique Event
        public: serverData.public !== false,
        recurrency: Boolean(serverData.recurrency),
        parent: serverData.parent ?? undefined,
        organizer: serverData.organizer ?? {},
        timeZone: serverData.timeZone || "",
        startDate: serverData.startDate
          ? new Date(serverData.startDate).toISOString()
          : "",
        endDate: serverData.endDate
          ? new Date(serverData.endDate).toISOString()
          : "",
        openingHours: extractOpeningHours(serverData.openingHours),
        // Helpers
        ...extractAddressFields(serverData.address),
      };

      return { defaultValues, entityType };
    }

    // POI (pas de socialNetwork, pas de shortDescription)
    if (isPoi(entity)) {
      const { serverData } = entity;

      const defaultValues: PoiProfileFormData = {
        name: serverData.name || "",
        description: serverData.description || "",
        type: serverData.type,
        tags: serverData.tags || [],
        slug: serverData.slug || "",
        // Spécifique POI
        urls: serverData.urls || [],
        // Helpers
        ...extractAddressFields(serverData.address),
      };

      return { defaultValues, entityType };
    }

    return { defaultValues: null, entityType };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, entity?.serverData?.updated]);
}
