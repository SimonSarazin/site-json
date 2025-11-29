import { useMemo } from "react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { isEvent, isOrganization, isProject, isUser } from "@/lib/getTypedEntity";
import { widgetFormatters } from "@/constants/DAYS";

/**
 * Interface pour les données de formulaire User
 */
export interface UserFormData {
  name: string;
  username?: string;
  shortDescription?: string;
  description?: string;
  email?: string;
  mobile?: string;
  url?: string;
  // Adresse complète
  addressCountry?: string;
  streetAddress?: string;
  postalCode?: string;
  addressLocality?: string;
  localityId?: string;
  level1?: string;
  level1Name?: string;
  level2?: string;
  level2Name?: string;
  level3?: string;
  level3Name?: string;
  level4?: string;
  level4Name?: string;
  codeInsee?: string;
  // Réseaux sociaux
  github?: string;
  gitlab?: string;
  facebook?: string;
  twitter?: string;
  instagram?: string;
  diaspora?: string;
  mastodon?: string;
  telegram?: string;
  signal?: string;
  // Organisation spécifique
  openingHours?: Array<{
    dayOfWeek: string;
    hours: Array<{ opens: string; closes: string }>;
  }>;
  // Tags
  tags?: string[];
}

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

      const defaultValues: UserFormData = {
        name: (serverData.name as string) || "",
        username: (serverData.username as string) || "",
        shortDescription: (serverData.shortDescription as string) || "",
        description: (serverData.description as string) || "",
        email: (serverData.email as string) || "",
        mobile: (serverData.mobile as string) || "",
        url: (serverData.url as string) || "",
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
      };

      return { defaultValues, entityType };
    }

    // Organization
    if (isOrganization(entity)) {
      const address = serverData.address && typeof serverData.address === 'object'
        ? serverData.address as Record<string, unknown>
        : {};

      // Normaliser les horaires d'ouverture avec le formatter
      const openingHours = serverData.openingHours && Array.isArray(serverData.openingHours)
        ? widgetFormatters.openingHours(serverData.openingHours).filter((d: { hours: unknown[] }) => d.hours.length > 0)
        : [];

      const defaultValues = {
        name: (serverData.name as string) || "",
        shortDescription: (serverData.shortDescription as string) || "",
        description: (serverData.description as string) || "",
        email: (serverData.email as string) || "",
        mobile: (serverData.mobile as string) || "",
        url: (serverData.url as string) || "",
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
        // Champs spécifiques aux organisations
        openingHours: openingHours,
        // Tags
        tags: Array.isArray(serverData.tags) ? serverData.tags as string[] : [],
      };

      return { defaultValues, entityType };
    }

    // Project
    if (isProject(entity)) {
      const address = serverData.address && typeof serverData.address === 'object'
        ? serverData.address as Record<string, unknown>
        : {};

      const defaultValues = {
        name: (serverData.name as string) || "",
        shortDescription: (serverData.shortDescription as string) || "",
        description: (serverData.description as string) || "",
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
      };

      return { defaultValues, entityType };
    }

    // Event
    if (isEvent(entity)) {
      const address = serverData.address && typeof serverData.address === 'object'
        ? serverData.address as Record<string, unknown>
        : {};

      const defaultValues = {
        name: (serverData.name as string) || "",
        shortDescription: (serverData.shortDescription as string) || "",
        description: (serverData.description as string) || "",
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
      };

      return { defaultValues, entityType };
    }

    return { defaultValues: null, entityType };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, entity?.serverData?.updated]);
}
