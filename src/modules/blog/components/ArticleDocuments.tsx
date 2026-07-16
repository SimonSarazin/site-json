import { useT } from "@/hooks/useT";
import type { LocalizedString } from "@/types/locale-schema";
import { FilesList, type DocFile } from "@/components/media/FilesList";

/**
 * Documents attachés d'un article (POI `type=article`) — fichiers `about.files` (OBJET keyé par `_id`,
 * `docPath` absolutisé par la lib `_imageFields`). Affichage seul (liste + téléchargement, `FilesList`).
 * Rien si aucun fichier. Pendant FICHIER de `ArticleGallery` (images).
 */
const TITLE: LocalizedString = { fr: "Documents", en: "Documents" };

export function ArticleDocuments({ files, className }: { files?: unknown; className?: string }) {
  const t = useT("modules/blog");
  const raw = files && typeof files === "object" && !Array.isArray(files)
    ? Object.values(files as Record<string, Record<string, unknown>>)
    : Array.isArray(files) ? (files as Record<string, unknown>[]) : [];
  const list: DocFile[] = raw
    .map((d) => {
      const _id = d._id as { $id?: string } | string | undefined;
      const docId = _id && typeof _id === "object" ? _id.$id : _id;
      return {
        docId: String(docId ?? d.id ?? ""),
        docPath: d.docPath as string | undefined,
        name: d.name as string | undefined,
        size: d.size as number | undefined,
        contentKey: d.contentKey as string | undefined,
      };
    })
    .filter((f) => !!f.docPath);
  if (list.length === 0) return null;

  return (
    <section className={className}>
      <h2 className="mb-4 text-xl font-bold text-foreground">{t(TITLE)}</h2>
      <FilesList files={list} />
    </section>
  );
}
