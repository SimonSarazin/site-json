import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { COFORM_QUERY_KEYS } from "../constants";
import type { ExistingUploadFile } from "../types";

interface UseCoFormAnswerFilesOptions {
  /** ID de la réponse CoForm */
  answerId: string;
  /** SubKey utilisé lors de l'upload (ex: "formId.inputId") */
  subKey: string;
  /** Type de document (par défaut "file") */
  docType?: "image" | "file";
  /** Activer/désactiver la requête */
  enabled?: boolean;
}

interface AnswerFile {
  id: string | null;
  name: string | null;
  size: number | null;
  docPath: string;
  imagePath: string | null;
  imageThumbPath: string | null;
  imageMediumPath: string | null;
}

interface UseCoFormAnswerFilesReturn {
  /** Liste des fichiers avec leur ID document pour suppression */
  files: ExistingUploadFile[];
  /** Nombre de fichiers */
  count: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook pour récupérer les fichiers d'un input uploader dans une réponse CoForm
 * 
 * Utilisé pour charger les fichiers de l'ancien système qui n'ont que la clé 'updateDate'
 * sans la clé 'files' dans la réponse.
 * 
 */
export function useCoFormAnswerFiles({
  answerId,
  subKey,
  docType = "file",
  enabled = true,
}: UseCoFormAnswerFilesOptions): UseCoFormAnswerFilesReturn {
  const { api, loading } = useCocolight();
  const isReady = !loading && !!api;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: COFORM_QUERY_KEYS.answerFiles(answerId, subKey),
    queryFn: async () => {
      if (!api) throw new Error("API non initialisée");

      const response = await api.endpointApi.coformGetAnswerFiles({
        answerId,
        subKey,
        docType,
      });

      const result = response?.serverData ?? response;
      
      if (!result.result) {
        throw new Error(result.msg || "Erreur lors de la récupération des fichiers");
      }

      const files: ExistingUploadFile[] = (result.files || [])
        .filter((f: AnswerFile) => f.id && f.docPath)
        .map((f: AnswerFile) => ({
          docId: f.id!,
          docPath: f.docPath,
          name: f.name ?? undefined,
        }));

      return {
        files,
        count: result.count || 0,
      };
    },
    enabled: enabled && isReady && !!answerId && !!subKey,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    files: data?.files ?? [],
    count: data?.count ?? 0,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
