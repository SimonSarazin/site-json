import { useRef } from "react";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useProfilPermissions } from "../../hooks/useProfilPermissions";
import { useGalleryImages, useGalleryMutations } from "../../hooks/useGallery";
import { GalleryGrid } from "@/components/media/GalleryGrid";
import { useT } from "@/hooks/useT";
import type { I18n } from "@/types/site-schema";
import type { ProfileGallerySection } from "../../schema";

const TITLE: I18n = { fr: "Galerie", en: "Gallery" };

/**
 * Section galerie du profil (entités NORMALES : org/projet/citoyen). Affichage + gestion INLINE (admin) :
 * ajout/suppression via le système de mutation (`useGalleryMutations` → toast + invalidation), l'entité
 * existant déjà. Lecture via `getGallery`. Périmètre A (org/projet/citoyen ; POI = galerie via l'article).
 */
export default function ProfileGallery({ section: _section }: { section: ProfileGallerySection }) {
  const t = useT("modules/profil");
  const { entity } = useProfileEntity();
  const perms = useProfilPermissions(entity);
  const { data: images = [], isLoading } = useGalleryImages(entity);
  const { add, remove } = useGalleryMutations(entity);
  const inputRef = useRef<HTMLInputElement>(null);
  const canManage = perms.canEditProfile;

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) if (f.type.startsWith("image/")) add.mutate(f);
  };

  if (!entity) return null;
  // Rien à montrer aux visiteurs si la galerie est vide (les admins voient toujours la tuile d'ajout).
  if (!isLoading && images.length === 0 && !canManage) return null;

  return (
    <section className="container mx-auto max-w-5xl px-4 py-8">
      <h2 className="mb-4 text-xl font-bold text-foreground">{t(TITLE)}</h2>
      <GalleryGrid
        images={images}
        onDelete={canManage ? (im) => { if (im.id) remove.mutate(im.id); } : undefined}
        onAddClick={canManage ? () => inputRef.current?.click() : undefined}
        deletingId={remove.isPending ? ((remove.variables as string | undefined) ?? null) : null}
      />
      {canManage && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }}
        />
      )}
    </section>
  );
}
