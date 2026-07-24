import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { useEntityBySlugQuery } from "@/hooks/useEntityBySlugQuery";
import type { GalleryImage } from "@/components/media/GalleryGrid";
import type { DocFile } from "@/components/media/FilesList";

/** Entité ressource COMPLÈTE (POI) : `images` (galerie, `about.images`) + `files` (`about.files`), URLs déjà absolues. */
interface ResourceEntity {
  images?: unknown;
  files?: unknown;
  [k: string]: unknown;
}

/** Médias classés d'une ressource, prêts à afficher (galerie/documents/audio/vidéo). */
export interface ResourceMedia {
  gallery: GalleryImage[];
  documents: DocFile[];
  /** URLs audio (docPath). */
  audio: string[];
  /** URLs vidéo (docPath). */
  video: string[];
  isLoading: boolean;
}

/** Instance (serverData) ou JSON déshydraté → on lit `serverData`, sinon l'objet. */
function toEntity(raw: unknown): ResourceEntity | null {
  if (!raw || typeof raw !== "object") return null;
  const sd = (raw as { serverData?: Record<string, unknown> }).serverData;
  return (sd && typeof sd === "object" ? sd : (raw as Record<string, unknown>)) as ResourceEntity;
}

// Extensions → type de média. On classe par EXTENSION (pas par `contentKey` : la lib réécrit le contentKey
// de l'audio en "presentation" dans about.files → non fiable, cf. resolveModalSpec). Source unique tous types.
const AUDIO_EXT = new Set(["mp3", "m4a", "wav", "ogg", "oga", "aac", "flac", "weba"]);
const VIDEO_EXT = new Set(["mp4", "webm", "mov", "m4v", "avi", "mkv", "ogv"]);

/** Extension minuscule depuis le nom (ou le docPath), sans query-string. */
function extOf(name?: string, docPath?: string): string {
  const base = (name || docPath || "").split("?")[0];
  return base.includes(".") ? base.split(".").pop()!.toLowerCase() : "";
}

/** Galerie = `about.images` avec `contentKey="slider"` (forme `getListOfImage`, URLs absolues). */
function extractGallery(entity: ResourceEntity | null): GalleryImage[] {
  const imgs = Array.isArray(entity?.images) ? (entity!.images as GalleryImage[]) : [];
  return imgs.filter((im) => im?.contentKey === "slider" && (im.imagePath || im.imageThumbPath));
}

/** `about.files` (objet keyé `_id` OU tableau) → normalisé puis CLASSÉ par extension : audio / vidéo / documents. */
function classifyFiles(entity: ResourceEntity | null): { documents: DocFile[]; audio: string[]; video: string[] } {
  const raw =
    entity?.files && typeof entity.files === "object" && !Array.isArray(entity.files)
      ? Object.values(entity.files as Record<string, Record<string, unknown>>)
      : Array.isArray(entity?.files)
        ? (entity!.files as Record<string, unknown>[])
        : [];

  const documents: DocFile[] = [];
  const audio: string[] = [];
  const video: string[] = [];

  for (const d of raw) {
    const docPath = d.docPath as string | undefined;
    if (!docPath) continue;
    const name = d.name as string | undefined;
    const ext = extOf(name, docPath);
    if (AUDIO_EXT.has(ext)) {
      audio.push(docPath);
    } else if (VIDEO_EXT.has(ext)) {
      video.push(docPath);
    } else {
      const rid = d._id as { $id?: string } | string | undefined;
      const docId = rid && typeof rid === "object" ? rid.$id : rid;
      documents.push({
        docId: String(docId ?? d.id ?? docPath),
        docPath,
        name,
        size: d.size as number | undefined,
        contentKey: d.contentKey as string | undefined,
      });
    }
  }
  return { documents, audio, video };
}

/**
 * Charge la ressource COMPLÈTE (POI) — par slug (`entityBySlug`) OU par id (`api.poi({id})`) — et renvoie ses
 * médias DÉJÀ CLASSÉS (galerie / documents / audio / vidéo). Même patron que `useArticle` (blog), mais la
 * récupération des fichiers est robuste au TYPE : `about.files` mélange documents + audio (+ vidéo) avec un
 * `contentKey` non fiable (audio → "presentation") → on classe par EXTENSION. Requête paresseuse (staleTime 5 min).
 */
export function useResourceEntity({ slug, id }: { slug?: string; id?: string }): ResourceMedia {
  const { api, loading } = useCocolight();
  const bySlug = useEntityBySlugQuery({ slug, options: { enabled: !!slug } });
  const byId = useQuery<unknown>({
    queryKey: ["searchResourceEntity", "byId", id ?? ""],
    enabled: !slug && !!id && !loading && !!api,
    queryFn: async () => {
      if (!api) throw new Error("API non initialisée");
      return api.poi({ id: id! });
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const useSlug = !!slug;
  const raw = useSlug ? bySlug.data : byId.data;
  const isLoading = useSlug ? bySlug.isLoading : byId.isLoading;

  return useMemo(() => {
    const entity = toEntity(raw);
    const { documents, audio, video } = classifyFiles(entity);
    return { gallery: extractGallery(entity), documents, audio, video, isLoading };
  }, [raw, isLoading]);
}
