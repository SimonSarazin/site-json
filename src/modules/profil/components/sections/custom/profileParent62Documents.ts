import type { DocFile } from "@/components/media/FilesList";

/**
 * `serverData.images` (toutes les images de la fiche) filtrées sur `contentKey:"presentation"` — les images
 * hors logo (ex. dépliant en plusieurs pages, vérifié sur `ditepJulesCatoire`). `useDocumentsList`
 * (`getGalleryFiles`, docType `file`) ne les voit jamais ; l'appel galerie sans `contentKey`
 * (`entity.getGallery`) ne les liste pas non plus (regroupées par dossier côté backend, `presentation` n'en
 * est pas un). Seule lecture directe de `serverData.images` les retrouve. Mappées au même shape que
 * `DocFile` pour fusion directe avec les documents dans la même liste « Documents » (pas de galerie
 * séparée — demande explicite).
 */
export function toPresentationDocs(value: unknown): DocFile[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((img): img is Record<string, unknown> => !!img && typeof img === "object" && img.contentKey === "presentation")
    .map((img) => ({
      docId: String(img.id ?? ""),
      docPath: typeof img.imagePath === "string" ? img.imagePath : undefined,
      name: typeof img.name === "string" ? img.name : undefined,
    }))
    .filter((f) => f.docId);
}
