/**
 * Invitation de membres PAR EMAIL (personnes sans compte existant).
 *
 * Appelle `entity.endpointApi.inviteEvent` → POST /co2/link/multiconnect avec `listInvite.invites`
 * (cf. port backend de Link::invite). Le backend crée un citoyen "pending" par email puis envoie
 * un mail d'invitation contenant le lien d'activation.
 *
 * ⚠️ Le contrat `inviteEvent` n'autorise `parentType` que parmi citoyens|projects|organizations :
 *    l'invitation par email N'EST PAS disponible pour les events tant que le contrat de la lib
 *    publiée n'inclut pas "events" (gardé côté UI via `canInviteByEmail`).
 */
import { useQueryClient } from "@tanstack/react-query";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { invalidateMemberQueries } from "./core";

export interface EmailInvite {
  /** Nom affiché de l'invité (défaut : l'email lui-même, comme le front legacy). */
  name: string;
  /** Clé `mail` (PAS `email`) : le legacy Link::invite lit `$value["mail"]` ; le contrat lib a été aligné. */
  mail: string;
  msg?: string;
  isAdmin?: "" | "admin";
  roles?: string[];
}

/** Types d'entité pour lesquels inviteEvent accepte l'invitation par email. */
export function canInviteByEmail(entity: EntityTypes | null): boolean {
  if (!entity) return false;
  const type = entity.getEntityType();
  return type === "organizations" || type === "projects";
}

/**
 * Hook de mutation : invite une liste d'emails comme membres de l'entité parente.
 */
export function useInviteByEmail(entity: EntityTypes | null) {
  const queryClient = useQueryClient();

  return useMutationWithToast<unknown, EmailInvite[]>({
    mutationFn: async (invites) => {
      if (!entity) throw new Error("No entity provided");
      const parentType = entity.getEntityType() as "citoyens" | "projects" | "organizations";
      // UUID v4 par invité (clé attendue par le contrat listInvite.invites).
      const listInvite = {
        invites: Object.fromEntries(invites.map((inv) => [crypto.randomUUID(), inv])),
      };
      return entity.endpointApi.inviteEvent({ parentId: entity.id!, parentType, listInvite });
    },
    namespace: "modules/profil",
    successKey: "toast.members.emailInviteSuccess",
    errorKey: "toast.members.emailInviteError",
    getSuccessParams: (_, invites) => ({ count: String(invites.length) }),
    onSuccessCallback: () => {
      if (entity) invalidateMemberQueries(queryClient, entity);
    },
  });
}
