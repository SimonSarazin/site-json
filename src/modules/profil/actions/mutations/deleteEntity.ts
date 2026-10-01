/**
 * Suppression d'une fiche. Fichier à part des autres mutations parce qu'elles agissent toutes sur un
 * LIEN entre un compte et une fiche (`relationship.ts` : suivre, rejoindre, quitter ; `member.ts` :
 * promouvoir, retirer un membre), là où celle-ci fait disparaître la fiche elle-même.
 *
 * Distinct de `@/modules/admin/hooks/useDeleteEntity` (même geste backend) : celui-ci suit la fabrique
 * `createEntityMutation` du module profil (entité liée au hook, toasts i18n `toast.*`), l'autre prend
 * l'entité à l'appel pour supprimer ligne par ligne depuis une table. Les deux invalident les mêmes
 * surfaces publiques (`publicSurfaceKeys`).
 */
import { createEntityMutation } from "./core";
import { PROFIL_QUERY_KEYS } from "../../constants/queryKeys";
import { publicSurfaceKeys } from "@/lib/queryKeys";

/**
 * Supprime DÉFINITIVEMENT la fiche : `element/delete`, via le `delete()` de l'entité SDK.
 *
 * ⚠ Ce n'est PAS le « retrait » du référencement (`reference.costum`, onglet Référencement de
 * l'admin), qui détache une fiche d'un costum en la laissant vivre ailleurs. Ici la fiche quitte
 * Communecter pour tous les sites à la fois.
 *
 * Trois gardes se superposent, et aucune ne remplace les autres :
 *  1. l'appelant ne propose l'action qu'à un ADMIN de la fiche, et seulement si le site l'a ouverte
 *     (`profile-header.showDeleteButton`) ;
 *  2. le SDK refuse si le compte n'est ni auteur ni administrateur (`isAuthorOrAdmin`) ;
 *  3. le backend tranche en dernier (`canDeleteElement`).
 *
 * Les surfaces PUBLIQUES (annuaire, carte, compteurs) sont invalidées en plus de la fiche : la fiche
 * disparue y resterait sinon affichée jusqu'au prochain rechargement complet. La redirection n'est pas faite
 * ici — la page de la fiche n'existe plus, mais seul l'appelant sait vers quoi partir : il la pose
 * en `onSuccess` de son `mutate`.
 */
export const useDeleteEntity = createEntityMutation({
  action: async (entity) => {
    // `delete()` n'est pas sur le type d'union `EntityTypes` : chaque classe SDK l'expose pour son
    // compte (Organization, Project, Event…). On sonde donc, plutôt que de caster en aveugle — un
    // type d'entité sans suppression doit échouer avec une phrase lisible, pas un « n'est pas une
    // fonction » au milieu d'un toast d'erreur.
    const suppressible = entity as { delete?: (reason?: string) => Promise<void> };
    if (typeof suppressible.delete !== "function") {
      throw new Error("Cette entité ne sait pas se supprimer (SDK sans `delete`).");
    }
    // La raison est tracée côté backend (audit) : elle dit d'où vient le geste.
    await suppressible.delete("suppression par un administrateur de la fiche");
  },
  i18n: {
    successKey: "toast.organization.deleteSuccess",
    errorKey: "toast.organization.deleteError",
  },
  invalidate: (entity) => [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug), ...publicSurfaceKeys()],
});
