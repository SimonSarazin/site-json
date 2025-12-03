import { useMemo } from "react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { isEvent, isOrganization, isProject, isUser, isPoi } from "@/lib/getTypedEntity";
import { widgetFormatters } from "@/constants/DAYS";
import type {
  UserProfileFormData,
  OrganizationProfileFormData,
  ProjectProfileFormData,
  EventProfileFormData,
  PoiProfileFormData,
} from "../schemaForm";

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
      const address = serverData.address ?? {};
      const socialNetworks = serverData.socialNetwork ?? {};

      const defaultValues: UserProfileFormData = {
        name: serverData.name || "",
        shortDescription: serverData.shortDescription || "",
        description: serverData.description || "",
        email: serverData.email || "",
        mobile: serverData.mobile || "",
        fixe: serverData.fixe || "",
        url: serverData.url || "",
        birthDate: serverData.birthDate
          ? new Date(serverData.birthDate).toISOString().split('T')[0]
          : "",
        // Adresse complète
        addressCountry: address.addressCountry || "",
        streetAddress: address.streetAddress || "",
        postalCode: address.postalCode || "",
        addressLocality: address.addressLocality || "",
        localityId: address.localityId || "",
        level1: address.level1 || "",
        level1Name: address.level1Name || "",
        level2: address.level2 || "",
        level2Name: address.level2Name || "",
        level3: address.level3 || "",
        level3Name: address.level3Name || "",
        level4: address.level4 || "",
        level4Name: address.level4Name || "",
        codeInsee: address.codeInsee || "",
        // Réseaux sociaux
        github: socialNetworks.github || "",
        gitlab: socialNetworks.gitlab || "",
        facebook: socialNetworks.facebook || "",
        twitter: socialNetworks.twitter || "",
        instagram: socialNetworks.instagram || "",
        diaspora: socialNetworks.diaspora || "",
        mastodon: socialNetworks.mastodon || "",
        telegram: socialNetworks.telegram || "",
        signal: socialNetworks.signal || "",
        // Tags
        tags: serverData.tags || [],
        // Slug
        slug: serverData.slug || "",
      };

      return { defaultValues, entityType };
    }

    // Organization
    if (isOrganization(entity)) {
      const { serverData } = entity;
      const address = serverData.address ?? {};
      const socialNetworks = serverData.socialNetwork ?? {};

      // Normaliser les horaires d'ouverture avec le formatter
      const openingHours = serverData.openingHours && Array.isArray(serverData.openingHours)
        ? widgetFormatters.openingHours(serverData.openingHours).filter((d: { hours: unknown[] }) => d.hours.length > 0)
        : [];

      const defaultValues: OrganizationProfileFormData = {
        name: serverData.name || "",
        shortDescription: serverData.shortDescription || "",
        description: serverData.description || "",
        email: serverData.email || "",
        url: serverData.url || "",
        type: serverData.type,
        // Adresse complète
        addressCountry: address.addressCountry || "",
        streetAddress: address.streetAddress || "",
        postalCode: address.postalCode || "",
        addressLocality: address.addressLocality || "",
        localityId: address.localityId || "",
        level1: address.level1 || "",
        level1Name: address.level1Name || "",
        level2: address.level2 || "",
        level2Name: address.level2Name || "",
        level3: address.level3 || "",
        level3Name: address.level3Name || "",
        level4: address.level4 || "",
        level4Name: address.level4Name || "",
        codeInsee: address.codeInsee || "",
        // Réseaux sociaux
        github: socialNetworks.github || "",
        gitlab: socialNetworks.gitlab || "",
        facebook: socialNetworks.facebook || "",
        twitter: socialNetworks.twitter || "",
        instagram: socialNetworks.instagram || "",
        diaspora: socialNetworks.diaspora || "",
        mastodon: socialNetworks.mastodon || "",
        telegram: socialNetworks.telegram || "",
        signal: socialNetworks.signal || "",
        // Champs spécifiques aux organisations
        openingHours: openingHours,
        // Tags
        tags: serverData.tags || [],
        // Slug
        slug: serverData.slug || "",
      };

      return { defaultValues, entityType };
    }

    // Project
    if (isProject(entity)) {
      const { serverData } = entity;
      const address = serverData.address ?? {};
      const socialNetworks = serverData.socialNetwork ?? {};

      // Parent au format { mongoId: { type, name } }
      const parent = serverData.parent ?? undefined;

      const defaultValues: ProjectProfileFormData = {
        name: serverData.name || "",
        shortDescription: serverData.shortDescription || "",
        description: serverData.description || "",
        email: serverData.email || "",
        url: serverData.url || "",
        avancement: serverData.avancement,
        parent,
        // Adresse complète
        addressCountry: address.addressCountry || "",
        streetAddress: address.streetAddress || "",
        postalCode: address.postalCode || "",
        addressLocality: address.addressLocality || "",
        localityId: address.localityId || "",
        level1: address.level1 || "",
        level1Name: address.level1Name || "",
        level2: address.level2 || "",
        level2Name: address.level2Name || "",
        level3: address.level3 || "",
        level3Name: address.level3Name || "",
        level4: address.level4 || "",
        level4Name: address.level4Name || "",
        codeInsee: address.codeInsee || "",
        // Réseaux sociaux
        github: socialNetworks.github || "",
        gitlab: socialNetworks.gitlab || "",
        facebook: socialNetworks.facebook || "",
        twitter: socialNetworks.twitter || "",
        instagram: socialNetworks.instagram || "",
        diaspora: socialNetworks.diaspora || "",
        mastodon: socialNetworks.mastodon || "",
        telegram: socialNetworks.telegram || "",
        signal: socialNetworks.signal || "",
        // Tags
        tags: serverData.tags || [],
        // Slug
        slug: serverData.slug || "",
      };

      return { defaultValues, entityType };
    }

    // Event
    if (isEvent(entity)) {
      const { serverData } = entity;
      const address = serverData.address ?? {};

      // Normaliser les horaires d'ouverture avec le formatter
      const openingHours = serverData.openingHours && Array.isArray(serverData.openingHours)
        ? widgetFormatters.openingHours(serverData.openingHours).filter((d: { hours: unknown[] }) => d.hours.length > 0)
        : [];

      // Parent et organizer
      const parent = serverData.parent ?? undefined;
      const organizer = serverData.organizer ?? {};

      const defaultValues: EventProfileFormData = {
        name: serverData.name || "",
        shortDescription: serverData.shortDescription || "",
        email: serverData.email || "",
        url: serverData.url || "",
        type: serverData.type,
        public: serverData.public !== false,
        recurrency: Boolean(serverData.recurrency),
        parent,
        organizer,
        // Dates et horaires
        timeZone: serverData.timeZone || "",
        startDate: serverData.startDate
          ? new Date(serverData.startDate).toISOString()
          : "",
        endDate: serverData.endDate
          ? new Date(serverData.endDate).toISOString()
          : "",
        openingHours: openingHours,
        // Adresse complète
        addressCountry: address.addressCountry || "",
        streetAddress: address.streetAddress || "",
        postalCode: address.postalCode || "",
        addressLocality: address.addressLocality || "",
        localityId: address.localityId || "",
        level1: address.level1 || "",
        level1Name: address.level1Name || "",
        level2: address.level2 || "",
        level2Name: address.level2Name || "",
        level3: address.level3 || "",
        level3Name: address.level3Name || "",
        level4: address.level4 || "",
        level4Name: address.level4Name || "",
        codeInsee: address.codeInsee || "",
        // Tags
        tags: serverData.tags || [],
        // Slug
        slug: serverData.slug || "",
      };

      return { defaultValues, entityType };
    }

    // POI
    if (isPoi(entity)) {
      const { serverData } = entity;
      const address = serverData.address ?? {};

      const defaultValues: PoiProfileFormData = {
        name: serverData.name || "",
        description: serverData.description || "",
        email: serverData.email || "",
        url: serverData.url || "",
        type: serverData.type,
        urls: serverData.urls || [],
        // Adresse complète
        addressCountry: address.addressCountry || "",
        streetAddress: address.streetAddress || "",
        postalCode: address.postalCode || "",
        addressLocality: address.addressLocality || "",
        localityId: address.localityId || "",
        level1: address.level1 || "",
        level1Name: address.level1Name || "",
        level2: address.level2 || "",
        level2Name: address.level2Name || "",
        level3: address.level3 || "",
        level3Name: address.level3Name || "",
        level4: address.level4 || "",
        level4Name: address.level4Name || "",
        codeInsee: address.codeInsee || "",
        // Tags
        tags: serverData.tags || [],
        // Slug
        slug: serverData.slug || "",
      };

      return { defaultValues, entityType };
    }

    return { defaultValues: null, entityType };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, entity?.serverData?.updated]);
}
