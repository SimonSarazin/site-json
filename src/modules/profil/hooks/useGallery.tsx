import { useQuery } from "@tanstack/react-query";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import type { GalleryImage } from "@/components/media/GalleryGrid";
import { PROFIL_QUERY_KEYS } from "../constants";

/**
 * Galerie d'images (documents `contentKey="slider"`) d'une entité NORMALE (org/projet/citoyen…), lue via
 * `entity.getGallery` (route `co2/gallery/index`, branche image → `docs` = les sliders, forme getListOfImage,
 * URLs absolues). Add/delete INLINE via le système de mutation profil (toast + invalidation de la query) —
 * l'entité existe déjà (un `id`) → appels directs `uploadDocument`/`deleteFile`, sans form ni orchestration.
 *
 * NB : `getGallery` est gardé pour `poi`/`events` côté lib (les POI lisent leur galerie via `about`/images).
 * Ce hook cible donc org/projet/citoyen/classified (périmètre A).
 */
// classifieds EXCLU : la lib override Classified.getGallery() pour throw 501 (pas de galerie image sur
// une annonce) → l'inclure mettait la query en erreur permanente. Les documents (getGalleryFiles, non
// overridé) restent supportés pour classifieds (cf. DOCUMENT_TYPES dans useDocuments).
const GALLERY_TYPES = new Set(["organizations", "projects", "citoyens"]);

interface EntityWithGallery {
  id?: string | null;
  getEntityType?: () => string;
  getGallery: (data?: { pathParams?: { docType?: "image" | "file" } }) => Promise<Record<string, unknown>>;
  uploadDocument: (file: File, opts: { contentKey: string; docType?: "image" | "file" }) => Promise<{ docId: string; docPath: string }>;
  deleteFile: (docId: string) => Promise<void>;
}

export function useGalleryImages(entity: EntityTypes | null) {
  const ent = entity as unknown as EntityWithGallery | null;
  const type = ent?.getEntityType?.();
  const supported = !!type && GALLERY_TYPES.has(type);
  return useQuery<GalleryImage[]>({
    queryKey: PROFIL_QUERY_KEYS.GALLERY(ent?.id ?? null),
    enabled: !!ent?.id && supported,
    queryFn: async () => {
      const res = await ent!.getGallery({ pathParams: { docType: "image" } });
      const docs = (res as { docs?: unknown }).docs;
      return Array.isArray(docs) ? (docs as GalleryImage[]) : [];
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

export function useGalleryMutations(entity: EntityTypes | null) {
  const ent = entity as unknown as EntityWithGallery | null;
  const galleryKey = PROFIL_QUERY_KEYS.GALLERY(ent?.id ?? null);

  const add = useMutationWithToast<{ docId: string; docPath: string }, File>({
    mutationFn: async (file) => {
      if (!ent) throw new Error("No entity provided");
      return ent.uploadDocument(file, { contentKey: "slider" });
    },
    namespace: "modules/profil",
    successKey: "toast.gallery.addSuccess",
    errorKey: "toast.gallery.addError",
    invalidateQueries: [galleryKey],
  });

  const remove = useMutationWithToast<void, string>({
    mutationFn: async (docId) => {
      if (!ent) throw new Error("No entity provided");
      await ent.deleteFile(docId);
    },
    namespace: "modules/profil",
    successKey: "toast.gallery.deleteSuccess",
    errorKey: "toast.gallery.deleteError",
    invalidateQueries: [galleryKey],
  });

  return { add, remove };
}
