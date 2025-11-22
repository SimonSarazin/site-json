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
        ? serverData.address as Record<string, any>
        : {};

      const socialNetworks = serverData.socialNetwork && typeof serverData.socialNetwork === 'object'
        ? serverData.socialNetwork as Record<string, any>
        : {};

      const defaultValues: UserFormData = {
        name: serverData.name || "",
        username: serverData.username || "",
        shortDescription: serverData.shortDescription || "",
        description: serverData.description || "",
        email: serverData.email || "",
        mobile: serverData.mobile || "",
        url: serverData.url || "",
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
      };

      return { defaultValues, entityType };
    }

    // Organization
    if (isOrganization(entity)) {
      const address = serverData.address && typeof serverData.address === 'object'
        ? serverData.address as Record<string, any>
        : {};

      // Normaliser les horaires d'ouverture avec le formatter
      const openingHours = serverData.openingHours && Array.isArray(serverData.openingHours)
        ? widgetFormatters.openingHours(serverData.openingHours).filter((d: any) => d.hours.length > 0)
        : [];

      const defaultValues = {
        name: serverData.name || "",
        shortDescription: serverData.shortDescription || "",
        description: serverData.description || "",
        email: serverData.email || "",
        mobile: serverData.mobile || "",
        url: serverData.url || "",
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
        // Champs spécifiques aux organisations
        openingHours: openingHours,
      };

      return { defaultValues, entityType };
    }

    // Project
    if (isProject(entity)) {
      const address = serverData.address && typeof serverData.address === 'object'
        ? serverData.address as Record<string, any>
        : {};

      const defaultValues = {
        name: serverData.name || "",
        shortDescription: serverData.shortDescription || "",
        description: serverData.description || "",
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
      };

      return { defaultValues, entityType };
    }

    // Event
    if (isEvent(entity)) {
      const address = serverData.address && typeof serverData.address === 'object'
        ? serverData.address as Record<string, any>
        : {};

      const defaultValues = {
        name: serverData.name || "",
        shortDescription: serverData.shortDescription || "",
        description: serverData.description || "",
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
      };

      return { defaultValues, entityType };
    }

    return { defaultValues: null, entityType };
  }, [entity]);
}
