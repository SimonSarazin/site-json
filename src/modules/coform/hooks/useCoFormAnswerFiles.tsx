import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { COFORM_QUERY_KEYS } from "../constants";
import type { ExistingUploadFile } from "../types";

interface UseCoFormAnswerFilesOptions {
  /** ID du formulaire parent (requis pour propager le contexte costum). */
  formId: string;
  /** ID de la réponse CoForm */
  answerId: string;
  /** SubKey utilisé lors de l'upload (ex: "formId.inputId") */
  subKey: string;
  /** Type de document (par défaut "file") */
  docType?: "image" | "file";
  /** Activer/désactiver la requête */
  enabled?: boolean;
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
 * Hook pour récupérer les fichiers d'un input uploader dans une réponse CoForm.
 *
 * Utilisé pour charger les fichiers de l'ancien système qui n'ont que la clé
 * `updateDate` sans la clé `files` dans la réponse.
 *
 * Délégation à la lib (1.0.134+) :
 *   form.answer({id}).getFiles({ subKey, docType }) → AnswerFileItem[]
 *
 * `AnswerFileItem` du SDK expose déjà `docId`, `docPath`, `name?` — mapping
 * direct sur `ExistingUploadFile` côté site-json.
 */
export function useCoFormAnswerFiles({
  formId,
  answerId,
  subKey,
  docType = "file",
  enabled = true,
}: UseCoFormAnswerFilesOptions): UseCoFormAnswerFilesReturn {
  const { api, loading, me } = useCocolight();
  const isReady = !loading && !!api;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: COFORM_QUERY_KEYS.ANSWER_FILES(answerId, subKey, me?.id ?? null),
    queryFn: async () => {
      if (!api) throw new Error("API non initialisée");

      const form = await api.form({ id: formId });
      const answer = await form.answer({ id: answerId });
      const fetched = await answer.getFiles({ subKey, docType });

      const files: ExistingUploadFile[] = fetched.map((f) => ({
        docId: f.docId,
        docPath: f.docPath,
        name: f.name,
      }));

      return { files, count: files.length };
    },
    enabled: enabled && isReady && !!formId && !!answerId && !!subKey,
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
