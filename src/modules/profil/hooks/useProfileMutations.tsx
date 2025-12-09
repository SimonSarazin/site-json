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

  return {
    canEdit: canEdit(),
    updateDescription: updateDescriptionMutation,
    updateInfo: updateInfoMutation,
    updateSocial: updateSocialMutation,
  };
}
