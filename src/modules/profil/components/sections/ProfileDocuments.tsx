import { useRef } from "react";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useProfilPermissions } from "../../hooks/useProfilPermissions";
import { useDocumentsList, useDocumentsMutations } from "../../hooks/useDocuments";
import { FilesList } from "@/components/media/FilesList";
import { useT } from "@/hooks/useT";
import type { LocalizedString } from "@/types/locale-schema";
import type { ProfileDocumentsSection } from "../../schema";

const TITLE: LocalizedString = { fr: "Documents", en: "Documents" };

/**
 * Section documents du profil (fichiers non-image). Affichage + gestion INLINE (admin) : ajout/suppression
 * via le système de mutation (`useDocumentsMutations` → toast + invalidation). Lecture via `getGalleryFiles`
 * (tous types : org/projet/citoyen/poi/events/classifieds). Pendant FICHIER de `ProfileGallery` (images).
 */
export default function ProfileDocuments({ section: _section }: { section: ProfileDocumentsSection }) {
  const t = useT("modules/profil");
  const { entity } = useProfileEntity();
  const perms = useProfilPermissions(entity);
  const { data: files = [], isLoading } = useDocumentsList(entity);
  const { add, remove } = useDocumentsMutations(entity);
  const inputRef = useRef<HTMLInputElement>(null);
  const canManage = perms.canEditProfile;

  const onFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    for (const f of Array.from(fileList)) add.mutate(f);
  };

  if (!entity) return null;
  // Rien à montrer aux visiteurs si la liste est vide (les admins voient toujours le bouton d'ajout).
  if (!isLoading && files.length === 0 && !canManage) return null;

  return (
    <section className="container mx-auto max-w-5xl px-4 py-8">
      <h2 className="mb-4 text-xl font-bold text-foreground">{t(TITLE)}</h2>
      <FilesList
        files={files}
        onDelete={canManage ? (f) => { if (f.docId) remove.mutate(f.docId); } : undefined}
        onAddClick={canManage ? () => inputRef.current?.click() : undefined}
        deletingId={remove.isPending ? ((remove.variables as string | undefined) ?? null) : null}
      />
      {canManage && (
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }}
        />
      )}
    </section>
  );
}
