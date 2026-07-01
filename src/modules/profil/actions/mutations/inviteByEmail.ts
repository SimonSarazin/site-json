/**
 * Invitation de membres PAR EMAIL (personnes sans compte existant).
 *
 * Passe par la méthode d'entité de haut niveau `entity.inviteByEmail(invites)` (lib) — qui génère
 * les UUID, construit `listInvite.invites`, valide le type et wrappe INVITE_EVENT
 * (POST /co2/link/multiconnect). On N'appelle PAS `endpointApi.inviteEvent` directement.
 * Le backend crée un citoyen "pending" par email puis envoie un mail d'invitation.
 *
 * ⚠️ Dispo pour organisations/projets uniquement (cf. `canInviteByEmail` + garde dans la lib).
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

/** Types d'entité pour lesquels l'invitation par email est supportée (cf. garde lib inviteByEmail). */
export function canInviteByEmail(entity: EntityTypes | null): boolean {
  if (!entity) return false;
  const type = entity.getEntityType();
  return type === "organizations" || type === "projects" || type === "events";
}

/**
 * Hook de mutation : invite une liste d'emails comme membres de l'entité parente.
 */
export function useInviteByEmail(entity: EntityTypes | null) {
  const queryClient = useQueryClient();

  return useMutationWithToast<unknown, EmailInvite[]>({
    mutationFn: async (invites) => {
      if (!entity) throw new Error("No entity provided");
      // Méthode d'entité de haut niveau : génère les UUID + listInvite, valide le type,
      // wrappe inviteEvent. Pas d'appel direct à endpointApi.
      return entity.inviteByEmail(invites);
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
