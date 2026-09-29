import { useState } from "react";
import { useNavigate } from "react-router";
import { Pencil, Trash2 } from "lucide-react";
import type { EntityTypes } from "@communecter/cocolight-api-client";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useT } from "@/hooks/useT";
import { useProfilPermissions } from "@/modules/profil/hooks/useProfilPermissions";
import { DynamicEditModal } from "@/modules/profil/components/profile-edit/EditModalRegistry";
import { useDeleteEntity, type DeletableEntity } from "@/modules/admin/hooks/useDeleteEntity";

interface ArticleAdminActionsProps {
  /** L'ENTITÉ SDK de l'article (pas ses données aplaties) — `useArticle().entity`. */
  entity: EntityTypes | null;
  /** Titre affiché dans la confirmation de suppression. */
  title?: string;
  /** Où retourner une fois l'article supprimé (sa page n'existe plus). */
  backTo?: string;
}

/**
 * Modifier / Supprimer sur la fiche d'un article, pour qui en a le droit.
 *
 * Ne rend RIEN par défaut : tout est gardé par `canEditProfile`, la même permission que les fiches
 * profil du site — vraie pour l'admin du costum sur toute fiche du costum, et pour l'auteur sur la
 * sienne. Un visiteur ne voit donc jamais ces boutons, et le backend reste juge à l'écriture
 * (`canDeleteElement`) : cette garde est un confort d'interface, pas la sécurité.
 *
 * Les trois briques sont RÉUTILISÉES, aucune n'est réécrite ici :
 *  - `DynamicEditModal` résout la modale via les `editModals` de la config (parent62 :
 *    `edit-parent62-article`, déjà employée par l'écran /admin) ;
 *  - `useDeleteEntity` porte le toast ET l'invalidation des surfaces publiques, fil blog compris ;
 *  - `ConfirmDialog` est le dialogue partagé du site.
 *
 * Après suppression on NAVIGUE : rester sur la fiche laisserait l'écran sur un article qui n'existe
 * plus, que le prochain rendu afficherait en « introuvable ».
 */
export function ArticleAdminActions({ entity, title, backTo = "/blog" }: ArticleAdminActionsProps) {
  const t = useT("modules/blog");
  const navigate = useNavigate();
  const { canEditProfile } = useProfilPermissions(entity);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const del = useDeleteEntity(() => {
    setConfirmOpen(false);
    void navigate(backTo);
  });

  if (!canEditProfile || !entity) return null;

  // `delete()` est exposé par org/project/poi/event ; la garde évite un bouton qui ne ferait rien
  // sur une entité qui ne le porte pas (contrat `DeletableEntity`).
  const supprimable = typeof (entity as Partial<DeletableEntity>).delete === "function";

  return (
    <div className="mx-auto flex max-w-3xl justify-end gap-2 px-4 pt-4">
      <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
        <Pencil className="mr-2 h-4 w-4" />
        {t("article.edit")}
      </Button>

      {supprimable && (
        <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" />
          {t("article.delete")}
        </Button>
      )}

      <DynamicEditModal open={editOpen} onOpenChange={setEditOpen} entity={entity} />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => del.mutate({ entity: entity as unknown as DeletableEntity, reason: "admin delete" })}
        title={t("article.deleteTitle")}
        description={t("article.deleteDescription", undefined, { title: title ?? "" })}
        confirmLabel={t("article.delete")}
        isDestructive
        isPending={del.isPending}
      />
    </div>
  );
}
