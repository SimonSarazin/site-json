import { useMemo } from "react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { isEvent, isOrganization, isProject, isUser } from "@/lib/getTypedEntity";
import { widgetFormatters } from "@/constants/DAYS";
import type {
  UserProfileFormData,
  OrganizationProfileFormData,
  ProjectProfileFormData,
  EventProfileFormData,
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

    const { serverData } = entity;
    const entityType = entity.getEntityType();

    // User
    if (isUser(entity)) {
      const address = serverData.address && typeof serverData.address === 'object'
        ? serverData.address as Record<string, unknown>
        : {};

      const socialNetworks = serverData.socialNetwork && typeof serverData.socialNetwork === 'object'
        ? serverData.socialNetwork as Record<string, unknown>
        : {};

      const defaultValues: UserProfileFormData = {
        name: (serverData.name as string) || "",
        shortDescription: (serverData.shortDescription as string) || "",
        description: (serverData.description as string) || "",
        email: (serverData.email as string) || "",
        mobile: (serverData.mobile as string) || "",
        fixe: (serverData.fixe as string) || "",
        url: (serverData.url as string) || "",
        birthDate: serverData.birthDate
          ? new Date(serverData.birthDate as Date).toISOString().split('T')[0]
          : "",
        // Adresse complète
        addressCountry: (address.addressCountry as string) || "",
        streetAddress: (address.streetAddress as string) || "",
        postalCode: (address.postalCode as string) || "",
        addressLocality: (address.addressLocality as string) || "",
        localityId: (address.localityId as string) || "",
        level1: (address.level1 as string) || "",
        level1Name: (address.level1Name as string) || "",
        level2: (address.level2 as string) || "",
        level2Name: (address.level2Name as string) || "",
        level3: (address.level3 as string) || "",
        level3Name: (address.level3Name as string) || "",
        level4: (address.level4 as string) || "",
        level4Name: (address.level4Name as string) || "",
        codeInsee: (address.codeInsee as string) || "",
        // Réseaux sociaux
        github: (socialNetworks.github as string) || "",
        gitlab: (socialNetworks.gitlab as string) || "",
        facebook: (socialNetworks.facebook as string) || "",
        twitter: (socialNetworks.twitter as string) || "",
        instagram: (socialNetworks.instagram as string) || "",
        diaspora: (socialNetworks.diaspora as string) || "",
        mastodon: (socialNetworks.mastodon as string) || "",
        telegram: (socialNetworks.telegram as string) || "",
        signal: (socialNetworks.signal as string) || "",
        // Tags
        tags: Array.isArray(serverData.tags) ? serverData.tags as string[] : [],
        // Slug
        slug: (serverData.slug as string) || "",
      };

      return { defaultValues, entityType };
    }

    // Organization
    if (isOrganization(entity)) {
      const address = serverData.address && typeof serverData.address === 'object'
        ? serverData.address as Record<string, unknown>
        : {};

      const socialNetworks = serverData.socialNetwork && typeof serverData.socialNetwork === 'object'
        ? serverData.socialNetwork as Record<string, unknown>
        : {};

      // Normaliser les horaires d'ouverture avec le formatter
      const openingHours = serverData.openingHours && Array.isArray(serverData.openingHours)
        ? widgetFormatters.openingHours(serverData.openingHours).filter((d: { hours: unknown[] }) => d.hours.length > 0)
        : [];

      const defaultValues: OrganizationProfileFormData = {
        name: (serverData.name as string) || "",
        shortDescription: (serverData.shortDescription as string) || "",
        description: (serverData.description as string) || "",
        email: (serverData.email as string) || "",
        url: (serverData.url as string) || "",
        type: serverData.type as OrganizationProfileFormData["type"],
        // Adresse complète
        addressCountry: (address.addressCountry as string) || "",
        streetAddress: (address.streetAddress as string) || "",
        postalCode: (address.postalCode as string) || "",
        addressLocality: (address.addressLocality as string) || "",
        localityId: (address.localityId as string) || "",
        level1: (address.level1 as string) || "",
        level1Name: (address.level1Name as string) || "",
        level2: (address.level2 as string) || "",
        level2Name: (address.level2Name as string) || "",
        level3: (address.level3 as string) || "",
        level3Name: (address.level3Name as string) || "",
        level4: (address.level4 as string) || "",
        level4Name: (address.level4Name as string) || "",
        codeInsee: (address.codeInsee as string) || "",
        // Réseaux sociaux
        github: (socialNetworks.github as string) || "",
        gitlab: (socialNetworks.gitlab as string) || "",
        facebook: (socialNetworks.facebook as string) || "",
        twitter: (socialNetworks.twitter as string) || "",
        instagram: (socialNetworks.instagram as string) || "",
        diaspora: (socialNetworks.diaspora as string) || "",
        mastodon: (socialNetworks.mastodon as string) || "",
        telegram: (socialNetworks.telegram as string) || "",
        signal: (socialNetworks.signal as string) || "",
        // Champs spécifiques aux organisations
        openingHours: openingHours,
        // Tags
        tags: Array.isArray(serverData.tags) ? serverData.tags as string[] : [],
        // Slug
        slug: (serverData.slug as string) || "",
      };

      return { defaultValues, entityType };
    }

    // Project
    if (isProject(entity)) {
      const address = serverData.address && typeof serverData.address === 'object'
        ? serverData.address as Record<string, unknown>
        : {};

      const socialNetworks = serverData.socialNetwork && typeof serverData.socialNetwork === 'object'
        ? serverData.socialNetwork as Record<string, unknown>
        : {};

      // Parent au format { mongoId: { type, name } }
      const parent = serverData.parent && typeof serverData.parent === 'object' && !Array.isArray(serverData.parent)
        ? serverData.parent as Record<string, { type: string; name?: string }>
        : undefined;

      const defaultValues: ProjectProfileFormData = {
        name: (serverData.name as string) || "",
        shortDescription: (serverData.shortDescription as string) || "",
        description: (serverData.description as string) || "",
        email: (serverData.email as string) || "",
        url: (serverData.url as string) || "",
        avancement: serverData.avancement as ProjectProfileFormData["avancement"],
        parent,
        // Adresse complète
        addressCountry: (address.addressCountry as string) || "",
        streetAddress: (address.streetAddress as string) || "",
        postalCode: (address.postalCode as string) || "",
        addressLocality: (address.addressLocality as string) || "",
        localityId: (address.localityId as string) || "",
        level1: (address.level1 as string) || "",
        level1Name: (address.level1Name as string) || "",
        level2: (address.level2 as string) || "",
        level2Name: (address.level2Name as string) || "",
        level3: (address.level3 as string) || "",
        level3Name: (address.level3Name as string) || "",
        level4: (address.level4 as string) || "",
        level4Name: (address.level4Name as string) || "",
        codeInsee: (address.codeInsee as string) || "",
        // Réseaux sociaux
        github: (socialNetworks.github as string) || "",
        gitlab: (socialNetworks.gitlab as string) || "",
        facebook: (socialNetworks.facebook as string) || "",
        twitter: (socialNetworks.twitter as string) || "",
        instagram: (socialNetworks.instagram as string) || "",
        diaspora: (socialNetworks.diaspora as string) || "",
        mastodon: (socialNetworks.mastodon as string) || "",
        telegram: (socialNetworks.telegram as string) || "",
        signal: (socialNetworks.signal as string) || "",
        // Tags
        tags: Array.isArray(serverData.tags) ? serverData.tags as string[] : [],
        // Slug
        slug: (serverData.slug as string) || "",
      };

      return { defaultValues, entityType };
    }

    // Event
    if (isEvent(entity)) {
      const address = serverData.address && typeof serverData.address === 'object'
        ? serverData.address as Record<string, unknown>
        : {};

      // Normaliser les horaires d'ouverture avec le formatter
      const openingHours = serverData.openingHours && Array.isArray(serverData.openingHours)
        ? widgetFormatters.openingHours(serverData.openingHours).filter((d: { hours: unknown[] }) => d.hours.length > 0)
        : [];

      // Parent et organizer au format { mongoId: { type, name } }
      const parent = serverData.parent && typeof serverData.parent === 'object' && !Array.isArray(serverData.parent)
        ? serverData.parent as Record<string, { type: string; name?: string }>
        : undefined;

      const organizer = serverData.organizer && typeof serverData.organizer === 'object' && !Array.isArray(serverData.organizer)
        ? serverData.organizer as Record<string, { type: string; name?: string }>
        : {};

      const defaultValues: EventProfileFormData = {
        name: (serverData.name as string) || "",
        shortDescription: (serverData.shortDescription as string) || "",
        email: (serverData.email as string) || "",
        url: (serverData.url as string) || "",
        type: serverData.type as EventProfileFormData["type"],
        public: serverData.public !== false,
        recurrency: Boolean(serverData.recurrency),
        parent,
        organizer,
        // Dates et horaires
        timeZone: (serverData.timeZone as string) || "",
        startDate: serverData.startDate
          ? new Date(serverData.startDate as Date).toISOString()
          : "",
        endDate: serverData.endDate
          ? new Date(serverData.endDate as Date).toISOString()
          : "",
        openingHours: openingHours,
        // Adresse complète
        addressCountry: (address.addressCountry as string) || "",
        streetAddress: (address.streetAddress as string) || "",
        postalCode: (address.postalCode as string) || "",
        addressLocality: (address.addressLocality as string) || "",
        localityId: (address.localityId as string) || "",
        level1: (address.level1 as string) || "",
        level1Name: (address.level1Name as string) || "",
        level2: (address.level2 as string) || "",
        level2Name: (address.level2Name as string) || "",
        level3: (address.level3 as string) || "",
        level3Name: (address.level3Name as string) || "",
        level4: (address.level4 as string) || "",
        level4Name: (address.level4Name as string) || "",
        codeInsee: (address.codeInsee as string) || "",
        // Tags
        tags: Array.isArray(serverData.tags) ? serverData.tags as string[] : [],
        // Slug
        slug: (serverData.slug as string) || "",
      };

      return { defaultValues, entityType };
    }

    return { defaultValues: null, entityType };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, entity?.serverData?.updated]);
}
