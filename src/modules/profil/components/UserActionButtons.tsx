import { UserPlus, UserCheck, UserMinus, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useUserPermissions } from "../hooks/useUserPermissions";
import {
  useFollowUser,
  useUnfollowUser,
  useSendFriendRequest,
  useRemoveFriend,
} from "../hooks/useRelationshipMutations";

interface UserActionButtonsProps {
  entity: EntityTypes | null;
}

/**
 * Composant pour afficher les boutons d'action sur un profil utilisateur
 * (Follow, Unfollow, Send Friend Request, Remove Friend)
 *
 * Affiche les boutons appropriés selon le statut de la relation avec l'utilisateur
 * - Pas de relation : Follow + Send Friend Request
 * - En train de suivre : Unfollow
 * - Ami : Remove Friend
 *
 * @param entity - L'entité utilisateur concernée
 */
export function UserActionButtons({ entity }: UserActionButtonsProps) {
  const t = useT("modules/profil");
  const { canFollow, isFollowing, canSendFriendRequest, isFriend } = useUserPermissions(entity);

  const followMutation = useFollowUser(entity);
  const unfollowMutation = useUnfollowUser(entity);
  const sendFriendRequestMutation = useSendFriendRequest(entity);
  const removeFriendMutation = useRemoveFriend(entity);

  // Ne rien afficher si l'utilisateur ne peut pas interagir avec ce profil
  if (!canFollow && !canSendFriendRequest) {
    return null;
  }

  const isLoading =
    followMutation.isPending ||
    unfollowMutation.isPending ||
    sendFriendRequestMutation.isPending ||
    removeFriendMutation.isPending;

  return (
    <div className="flex gap-3 flex-wrap">
      {/* Bouton Follow/Unfollow */}
      {canFollow && !isFriend && (
        <Button
          onClick={() => {
            if (isFollowing) {
              unfollowMutation.mutate();
            } else {
              followMutation.mutate();
            }
          }}
          disabled={isLoading}
          variant="outline"
          className="px-5 py-2.5 border border-border rounded-lg text-foreground bg-card text-sm font-medium hover:bg-muted flex items-center gap-2 shadow-sm"
        >
          {isFollowing ? (
            <>
              <UserCheck className="w-4 h-4" />
              {t("ProfileTemplateDefault.unfollow")}
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              {t("ProfileTemplateDefault.follow")}
            </>
          )}
        </Button>
      )}

      {/* Bouton Friend Request / Remove Friend */}
      {canSendFriendRequest && (
        <Button
          onClick={() => {
            if (isFriend) {
              removeFriendMutation.mutate();
            } else {
              sendFriendRequestMutation.mutate();
            }
          }}
          disabled={isLoading}
          variant="outline"
          className="px-5 py-2.5 border border-border rounded-lg text-foreground bg-card text-sm font-medium hover:bg-muted flex items-center gap-2 shadow-sm"
        >
          {isFriend ? (
            <>
              <UserX className="w-4 h-4" />
              {t("ProfileTemplateDefault.removeFriend")}
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              {t("ProfileTemplateDefault.sendFriendRequest")}
            </>
          )}
        </Button>
      )}
    </div>
  );
}
