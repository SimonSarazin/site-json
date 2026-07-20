import { useQuery } from "@tanstack/react-query";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import type { DocFile } from "@/components/media/FilesList";
import { PROFIL_QUERY_KEYS } from "../constants";

/**
 * Documents (FICHIERS non-image, `doctype:"file"`) d'une entité, lus via `entity.getGalleryFiles`
 * (`co2/gallery/index` docType=file → liste typée `{docId,docPath,name,size,contentKey}`, URLs absolues,
 * source UNIQUE tous types). Add/delete INLINE via le système de mutation profil (toast + invalidation) —
 * l'entité existe déjà (un `id`). Miroir FICHIER de `useGallery` (images) ; contraste : liste (pas grille),
 * pas de lightbox, tous types (org/projet/citoyen/poi/events/classifieds).
 */
const DOCUMENT_TYPES = new Set(["organizations", "projects", "citoyens", "classifieds", "poi", "events"]);

interface EntityWithDocs {
  id?: string | null;
  getEntityType?: () => string;
  getGalleryFiles: () => Promise<DocFile[]>;
  uploadDocument: (file: File, opts: { contentKey: string; docType?: "image" | "file" }) => Promise<{ docId: string; docPath: string }>;
  deleteFile: (docId: string) => Promise<void>;
}

export function useDocumentsList(entity: EntityTypes | null) {
  const ent = entity as unknown as EntityWithDocs | null;
  const type = ent?.getEntityType?.();
  const supported = !!type && DOCUMENT_TYPES.has(type);
  return useQuery<DocFile[]>({
    queryKey: PROFIL_QUERY_KEYS.DOCUMENTS(ent?.id ?? null),
    enabled: !!ent?.id && supported,
    queryFn: () => ent!.getGalleryFiles(),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

export function useDocumentsMutations(entity: EntityTypes | null) {
  const ent = entity as unknown as EntityWithDocs | null;
  const key = PROFIL_QUERY_KEYS.DOCUMENTS(ent?.id ?? null);

  const add = useMutationWithToast<{ docId: string; docPath: string }, File>({
    mutationFn: async (file) => {
      if (!ent) throw new Error("No entity provided");
      // contentKey:"file" envoyé ; le backend le réécrit en pdf/spreadsheet/text/presentation (getFileContentKey).
      return ent.uploadDocument(file, { contentKey: "file", docType: "file" });
    },
    namespace: "modules/profil",
    successKey: "toast.documents.addSuccess",
    errorKey: "toast.documents.addError",
    invalidateQueries: [key],
  });

  const remove = useMutationWithToast<void, string>({
    mutationFn: async (docId) => {
      if (!ent) throw new Error("No entity provided");
      await ent.deleteFile(docId);
    },
    namespace: "modules/profil",
    successKey: "toast.documents.deleteSuccess",
    errorKey: "toast.documents.deleteError",
    invalidateQueries: [key],
  });

  return { add, remove };
}
