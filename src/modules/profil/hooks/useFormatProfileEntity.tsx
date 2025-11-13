import { useMemo } from "react";
import type { SearchEntity } from "@/modules/search/schema";
import type { GeoCoordinates, OpeningHoursEntry, PostalAddress } from "@communecter/cocolight-api-client";

interface Badge {
  name?: string;
  show?: string | boolean;
  [key: string]: unknown;
}

interface Organizer {
  name?: string;
  slug?: string;
  profilThumbImageUrl?: string;
  [key: string]: unknown;
}


/**
 * Hook pour extraire et formater les données d'une entité de profil
 * @param entity - L'entité SearchEntity provenant de l'API
 * @returns Objet contenant toutes les données formatées du profil
 */
export function useFormatProfileEntity(entity: SearchEntity) {
  // Images
  const logoUrl = useMemo((): string | null => {
    return entity.serverData?.profilImageUrl ?? null;
  }, [entity.serverData?.profilImageUrl]);

  const imageUrl = useMemo((): string | null => {
    if (entity.serverData?.profilMediumImageUrl) {
      return entity.serverData.profilMediumImageUrl;
    }
    if (entity.serverData?.profilImageUrl) {
      return entity.serverData.profilImageUrl;
    }
    return null;
  }, [entity.serverData?.profilMediumImageUrl, entity.serverData?.profilImageUrl]);

  const address = useMemo((): PostalAddress | null => {
    const addr = entity.serverData?.address;
    if (addr && typeof addr === "object") {
      return {
        streetAddress: addr?.streetAddress,
        postalCode: addr?.postalCode,
        addressLocality: addr?.addressLocality
      };
    }
    return null;
  }, [entity.serverData?.address]);

  // Organizer (premier organizer pour compatibilité)
  const organizer = useMemo((): Organizer | null => {
    if (entity.serverData?.organizer && typeof entity.serverData.organizer === "object") {
      const organizerId = Object.keys(entity.serverData.organizer)[0];
      return entity.serverData.organizer[organizerId] as Organizer;
    }
    return null;
  }, [entity.serverData?.organizer]);

  // Tous les organizers
  const organizers = useMemo((): Record<string, Organizer> => {
    if (entity.serverData?.organizer && typeof entity.serverData.organizer === "object") {
      return entity.serverData.organizer as Record<string, Organizer>;
    }
    return {};
  }, [entity.serverData?.organizer]);

  // Informations de base
  const name = useMemo((): string => {
    return entity?.serverData?.name ?? "Sans nom";
  }, [entity?.serverData?.name]);

  const shortDescription = useMemo((): string | null => {
    return entity.serverData?.shortDescription && typeof entity.serverData.shortDescription === "string"
      ? entity.serverData.shortDescription
      : null;
  }, [entity.serverData?.shortDescription]);

  const description = useMemo((): string | null => {
    return entity.serverData?.description && typeof entity.serverData.description === "string"
      ? entity.serverData.description
      : null;
  }, [entity.serverData?.description]);

  const type = useMemo((): string | null => {
    return entity.serverData?.type && typeof entity.serverData.type === "string"
      ? entity.serverData.type
      : null;
  }, [entity.serverData?.type]);

  const bannerUrl = useMemo((): string | null => {
    if (entity.serverData?.profilBannerUrl) {
      return entity.serverData.profilBannerUrl;
    }
    if (entity.serverData?.profilRealBannerUrl) {
      return entity.serverData.profilRealBannerUrl;
    }
    return null;
  }, [entity.serverData?.profilBannerUrl, entity.serverData?.profilRealBannerUrl]);

  const tags = useMemo((): string[] => {
    if (entity.serverData?.tags && Array.isArray(entity.serverData.tags)) {
      return entity.serverData.tags.filter((tag: unknown): tag is string => typeof tag === "string");
    }
    return [];
  }, [entity.serverData?.tags]);

  const badges = useMemo((): Badge[] => {
    if (entity.serverData?.badges && typeof entity.serverData.badges === "object") {
      return Object.values(entity.serverData.badges).filter((badge: unknown): badge is Badge =>
        badge !== null &&
        typeof badge === "object" &&
        "show" in badge &&
        badge.show !== "false"
      );
    }
    return [];
  }, [entity.serverData?.badges]);

  const membersCount = useMemo((): number | null => {
    if (entity.serverData?.links && typeof entity.serverData.links === "object") {
      const links = entity.serverData.links as Record<string, unknown>;
      if (links.members && typeof links.members === "object") {
        return Object.keys(links.members as Record<string, unknown>).length;
      }
    }
    return null;
  }, [entity.serverData?.links]);

  const projectsCount = useMemo((): number | null => {
    if (entity.serverData?.links && typeof entity.serverData.links === "object") {
      const links = entity.serverData.links as Record<string, unknown>;
      if (links.projects && typeof links.projects === "object") {
        return Object.keys(links.projects as Record<string, unknown>).length;
      }
    }
    return null;
  }, [entity.serverData?.links]);

  const openingHours = useMemo((): OpeningHoursEntry[] | null => {
    if (entity.serverData?.openingHours && Array.isArray(entity.serverData.openingHours)) {
      return entity.serverData.openingHours as OpeningHoursEntry[];
    }
    return null;
  }, [entity.serverData?.openingHours]);

  // Dates
  const startDate = useMemo(() => {
    return entity.serverData?.startDate ?? null;
  }, [entity.serverData?.startDate]);

  const endDate = useMemo(() => {
    return entity.serverData?.endDate ?? null;
  }, [entity.serverData?.endDate]);

  const openingDate = useMemo(() => {
    return entity.serverData?.openingDate ?? null;
  }, [entity.serverData?.openingDate]);

  // Contact
  const email = useMemo((): string | null => {
    return entity.serverData?.email && typeof entity.serverData.email === "string"
      ? entity.serverData.email
      : null;
  }, [entity.serverData?.email]);

  const mobile = useMemo((): string | null => {
    return entity.serverData?.mobile && typeof entity.serverData.mobile === "string"
      ? entity.serverData.mobile
      : null;
  }, [entity.serverData?.mobile]);

  const url = useMemo((): string | null => {
    return entity.serverData?.url && typeof entity.serverData.url === "string"
      ? entity.serverData.url
      : null;
  }, [entity.serverData?.url]);

  const username = useMemo((): string | null => {
    return entity.serverData?.username && typeof entity.serverData.username === "string"
      ? entity.serverData.username
      : null;
  }, [entity.serverData?.username]);

  const externalLinkRegistration = useMemo((): string | null => {
    return entity.serverData?.externalLinkRegistration && typeof entity.serverData.externalLinkRegistration === "string"
      ? entity.serverData.externalLinkRegistration
      : null;
  }, [entity.serverData?.externalLinkRegistration]);

  // Géolocalisation
  const geo = useMemo((): GeoCoordinates | null => {
    const geoData = entity.serverData?.geo;
    if (geoData && typeof geoData === "object") {
      return geoData as GeoCoordinates;
    }
    return null;
  }, [entity.serverData?.geo]);

  return {
    // Images
    logoUrl,
    imageUrl,
    bannerUrl,

    // Informations de base
    name,
    shortDescription,
    description,
    type,

    // Adresse et localisation
    address,
    geo,

    // Organisateurs
    organizer,
    organizers,

    // Dates
    startDate,
    endDate,
    openingDate,
    openingHours,

    // Contact
    email,
    mobile,
    url,
    username,
    externalLinkRegistration,

    // Métadonnées
    tags,
    badges,
    membersCount,
    projectsCount,
  };
}
