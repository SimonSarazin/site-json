import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { useProfileEntity } from "./useProfileEntity";

interface UpdateDescriptionData {
  shortDescription?: string | null;
  description?: string | null;
  [key: string]: string | null | undefined;
}

interface UpdateInfoData {
  name?: string | null;
  email?: string | null;
  url?: string | null;
  tags?: string[] | null;
  fixe?: string | null;
  mobile?: string | null;
  birthDate?: string | null;
  type?: string | null;
  avancement?: string | null;
  [key: string]: string | string[] | null | undefined;
}

interface UpdateSocialData {
  facebook?: string | null;
  instagram?: string | null;
  twitter?: string | null;
  github?: string | null;
  gitlab?: string | null;
  telegram?: string | null;
  signal?: string | null;
  mastodon?: string | null;
  diaspora?: string | null;
  [key: string]: string | null | undefined;
}
interface ApiAddressData {
  "@type": "PostalAddress";
  addressCountry: string;
  addressLocality: string;
  localityId: string;
  codeInsee: string;
  level1: string;
  level1Name: string;
  level3?: string;
  level3Name?: string;
  level4?: string;
  level4Name?: string;
  postalCode?: string;
  streetAddress?: string;
}

interface GeoData {
  "@type"?: "GeoCoordinates";
  latitude: string | number;
  longitude: string | number;
}

interface GeoPositionData {
  type: "Point";
  coordinates: [number, number];
  float: true;
}

interface UpdateLocalityData {
  address: ApiAddressData | "";
  geo?: GeoData;
  geoPosition?: GeoPositionData;
  [key: string]: ApiAddressData | "" | GeoData | GeoPositionData | undefined;
}

interface OpeningHourEntry {
  dayOfWeek: string;
  hours?: Array<{ opens: string; closes: string }>;
}

interface UpdateProfileImageData {
  profil_avatar: File;
}

interface UpdateBannerImageData {
  banner: File;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
}

export function useProfileMutations() {
  const { entity } = useProfileEntity();
  const { me } = useCocolight();
  const queryClient = useQueryClient();

  const updateCache = (updates: Record<string, unknown>) => {
    if (!entity?.slug) return;

    const serverData = entity.serverData as Record<string, unknown> | undefined;
    if (serverData) {
      Object.keys(updates).forEach((key) => {
        serverData[key] = updates[key];
      });
    }

    queryClient.refetchQueries({
      queryKey: ["element-about", entity.slug],
    });
  };

  const updateSocialCache = (updates: Record<string, unknown>) => {
    if (!entity?.slug) return;

    const serverData = entity.serverData as Record<string, unknown> | undefined;
    if (serverData) {
      let socialNetwork = serverData.socialNetwork as Record<string, unknown> | undefined;
      if (!socialNetwork) {
        socialNetwork = {};
        serverData.socialNetwork = socialNetwork;
      }

      Object.keys(updates).forEach((key) => {
        const value = updates[key];
        if (value === "" || value === null || value === undefined) {
          delete socialNetwork![key];
        } else {
          socialNetwork![key] = value;
        }
      });
    }

    queryClient.refetchQueries({
      queryKey: ["element-about", entity.slug],
    });
  };

  const canEdit = (): boolean => {
    if (!me?.isConnected || !entity) return false;

    const userId = me.id;
    if (!userId) return false;

    const entityServerData = entity.serverData as Record<string, unknown> | undefined;
    const entityId = entity.id;
    const entityType = entity.getEntityType?.();

    const linkTypeMappings: Record<string, string> = {
      organizations: "memberOf",
      citoyens: "friends",
      projects: "projects",
      events: "events",
    };

    const isAuthor = (): boolean => {
      if (entityId === userId) return true;
      const creatorId = entityServerData?.creator as string | undefined;
      if (creatorId && creatorId === userId) return true;
      return false;
    };

    const isScopeAdmin = (): boolean => {
      if (!entityType || !entityId) return false;

      const scopeKey = linkTypeMappings[entityType] ?? entityType;
      const meServerData = me.serverData as Record<string, unknown> | undefined;
      const meLinks = meServerData?.links as Record<string, Record<string, {
        type?: string;
        isAdmin?: boolean;
        toBeValidated?: boolean;
        isInviting?: boolean;
        isAdminPending?: boolean;
        isAdminInviting?: boolean;
      }>> | undefined;

      if (!meLinks) return false;

      const scopeLinks = meLinks[scopeKey];
      if (!scopeLinks) return false;

      const link = scopeLinks[entityId];
      if (!link) return false;

      const hasAdmin = !!link.isAdmin;
      const notToBeValidated = !link.toBeValidated;
      const notInviting = !link.isInviting;
      const notAdminPending = !link.isAdminPending;
      const notAdminInviting = !link.isAdminInviting;

      return hasAdmin && notToBeValidated && notInviting && notAdminPending && notAdminInviting;
    };

    if (isAuthor() || isScopeAdmin()) {
      return true;
    }

    const preferences = entityServerData?.preferences as Record<string, unknown> | undefined;
    if (preferences?.isOpenEdition) return true;

    return false;
  };

  interface ApiResponse {
    result: boolean;
    resultGoods?: {
      result: boolean;
      msg: string;
      values: Record<string, unknown>;
    };
  }

  const updateDescriptionMutation = useMutation({
    mutationFn: async (data: UpdateDescriptionData) => {
      if (!entity || !("updateDescription" in entity)) {
        throw new Error("Entity does not support updateDescription");
      }

      const response = await entity.updateDescription(data) as ApiResponse;
      return response?.resultGoods?.values || data;
    },
    onSuccess: (updatedValues) => {
      updateCache(updatedValues as Record<string, unknown>);
    },
  });

  const updateInfoMutation = useMutation({
    mutationFn: async (data: UpdateInfoData) => {
      if (!entity || !("updateInfo" in entity)) {
        throw new Error("Entity does not support updateInfo");
      }

      const response = await entity.updateInfo(data) as ApiResponse;
      return response?.resultGoods?.values || data;
    },
    onSuccess: (updatedValues) => {
      updateCache(updatedValues as Record<string, unknown>);
    },
  });

  const updateSocialMutation = useMutation({
    mutationFn: async (data: UpdateSocialData) => {
      if (!entity || !("updateSocial" in entity)) {
        throw new Error("Entity does not support updateSocial");
      }

      const response = await entity.updateSocial(data) as ApiResponse;
      return response?.resultGoods?.values || data;
    },
    onSuccess: (updatedValues) => {
      updateSocialCache(updatedValues as Record<string, unknown>);
    },
  });

  const updateLocalityMutation = useMutation({
    mutationFn: async (data: UpdateLocalityData) => {
      if (!entity || !("updateLocality" in entity)) {
        throw new Error("error");
      }

      const response = await entity.updateLocality(data) as ApiResponse;
      return { data, response };
    },
    onSuccess: ({ data }) => {
      if (!entity?.slug) return;

      const serverData = entity.serverData as Record<string, unknown> | undefined;
      if (serverData) {
        if (data.address === "" || !data.address) {
          delete serverData.address;
          delete serverData.geo;
          delete serverData.geoPosition;
        } else {
          serverData.address = data.address;
          if (data.geo) serverData.geo = data.geo;
          if (data.geoPosition) serverData.geoPosition = data.geoPosition;
        }
      }

      queryClient.refetchQueries({
        queryKey: ["element-about", entity.slug],
      });
    },
  });

  const updateOpeningHoursMutation = useMutation({
    mutationFn: async (data: OpeningHourEntry[]) => {
      if (!entity || !("updateOpeningHours" in entity)) {
        throw new Error("error2");
      }

      const response = await (entity as { updateOpeningHours: (hours: OpeningHourEntry[]) => Promise<unknown> }).updateOpeningHours(data);
      return { data, response };
    },
    onSuccess: ({ data }) => {
      if (!entity?.slug) return;

      const serverData = entity.serverData as Record<string, unknown> | undefined;
      if (serverData) {
        serverData.openingHours = data;
      }

      queryClient.refetchQueries({
        queryKey: ["element-about", entity.slug],
      });
    },
  });

  const updateProfileImageMutation = useMutation({
    mutationFn: async (data: UpdateProfileImageData) => {
      if (!entity || !("updateImageProfil" in entity)) {
        throw new Error("error updateImageProfil");
      }

      await (entity as { updateImageProfil: (data: { profil_avatar: File }) => Promise<unknown> }).updateImageProfil(data);
    },
  });

  const updateBannerImageMutation = useMutation({
    mutationFn: async (data: UpdateBannerImageData) => {
      if (!entity || !("updateImageBanner" in entity)) {
        throw new Error("error updateImageBanner");
      }

      await (entity as { updateImageBanner: (data: { banner: File; cropX: number; cropY: number; cropW: number; cropH: number }) => Promise<unknown> }).updateImageBanner(data);
    },
  });

  return {
    canEdit: canEdit(),
    updateDescription: updateDescriptionMutation,
    updateInfo: updateInfoMutation,
    updateSocial: updateSocialMutation,
    updateLocality: updateLocalityMutation,
    updateOpeningHours: updateOpeningHoursMutation,
    updateProfileImage: updateProfileImageMutation,
    updateBannerImage: updateBannerImageMutation,
  };
}
