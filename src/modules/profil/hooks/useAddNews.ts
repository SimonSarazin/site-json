import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { useProfileEntity } from "./useProfileEntity";

interface AddNewsParams {
  text: string;
  tags?: string[];
  scope?: "public" | "private" | "restricted";
  images?: File[];
  documents?: File[];
}

export function useAddNews() {
  const { api, apiClient } = useCocolight();
  const queryClient = useQueryClient();
  const { entity, entityType } = useProfileEntity();

  const addNews = useMutation({
    mutationFn: async ({ text, tags = [], scope = "public", images = [], documents = [] }: AddNewsParams) => {
      if (!api || !apiClient) {
        throw new Error("API client not initialized");
      }

      let parentId: string;
      let parentType: "citoyens" | "projects" | "organizations";

      if (entityType === "citoyens") {
        parentId = entity?.serverData?.id || entity?.data?.id || "";
        parentType = "citoyens";
      } else if (entityType === "projects") {
        parentId = entity?.serverData?.id || entity?.data?.id || "";
        parentType = "projects";
      } else if (entityType === "organizations") {
        parentId = entity?.serverData?.id || entity?.data?.id || "";
        parentType = "organizations";
      } else {
        throw new Error("error");
      }

      if (!parentId) {
        throw new Error("Cannot determine parent ID for news");
      }

      const uploadedImageIds: string[] = [];
      if (images.length > 0) {
        for (const imageFile of images) {
          try {
            const imageResponse = await api.endpointApi.addImageNews({
              newsImage: imageFile as any,
              pathParams: {
                folder: parentType,
                ownerId: parentId,
              },
            });


            if (imageResponse?.id) {
              uploadedImageIds.push(imageResponse.id);
            } else {
            }
          } catch (error) {
          }
        }
      }

      const uploadedFileIds: string[] = [];
      if (documents.length > 0) {
        for (const documentFile of documents) {
          try {
            const fileResponse = await api.endpointApi.addFileNews({
              newsFile: documentFile as any,
              pathParams: {
                folder: parentType,
                ownerId: parentId,
              },
            });


            if (fileResponse?.id) {
              uploadedFileIds.push(fileResponse.id);
            } else {
            }
          } catch (error) {
          }
        }
      }

      const requestData: any = {
        scope,
        markdownActive: true,
        parentId,
        parentType,
        type: "news" as const,
        json: true as const,
      };

      if (text && text.trim()) {
        requestData.text = text;
      }

      if (tags.length > 0) {
        requestData.tags = tags;
      }

      if (uploadedImageIds.length > 0) {
        requestData.mediaImg = {
          countImages: uploadedImageIds.length,
          images: uploadedImageIds,
        };
      }

      if (uploadedFileIds.length > 0) {
        requestData.mediaFile = {
          countFiles: uploadedFileIds.length,
          files: uploadedFileIds,
        };
      }


      const response = await api.endpointApi.addNews(requestData);


      return response;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["profile-news"] });

      if (response?.data?.result && response?.data?.object) {
      }
    },
    onError: (error) => {
      console.log(error)
    },
  });

  return {
    addNews: addNews.mutate,
    addNewsAsync: addNews.mutateAsync,
    isAddingNews: addNews.isPending,
    error: addNews.error,
    isSuccess: addNews.isSuccess,
  };
}
