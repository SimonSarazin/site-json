/**
 * Factory et utilitaires pour créer des mutations d'entités
 */
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { EntityTypes, User } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { isUser, isOrganization, isProject, isEvent } from "@/lib/getTypedEntity";
import { PROFIL_QUERY_KEYS } from "../../constants/queryKeys";
import { emitEntityAction, type EntityActionType } from "../entityActionBus";

export type EntityType = "user" | "organization" | "project" | "event";

/**
 * Détermine le type d'une entité
 */
export function getEntityType(entity: EntityTypes): EntityType | null {
  if (isUser(entity)) return "user";
  if (isOrganization(entity)) return "organization";
  if (isProject(entity)) return "project";
  if (isEvent(entity)) return "event";
  return null;
}

/**
 * Configuration pour créer une mutation d'entité
 */
export interface EntityMutationConfig<TParams = void> {
  /** Types d'entité supportés (undefined = tous) */
  entityTypes?: EntityType[];
  /** Action à exécuter */
  action: (entity: EntityTypes, params: TParams) => Promise<void>;
  /** Clés i18n pour les toasts */
  i18n: {
    successKey: string;
    errorKey: string;
  };
  /** Fonction pour calculer les query keys à invalider */
  invalidate: (entity: EntityTypes, me: User | null) => QueryKey[];
  /** Type d'action émis sur le bus post-succès (entityActionBus) — opt-in, additif */
  actionType?: EntityActionType;
  /** Paramètres dynamiques pour les messages (optionnel) */
  getSuccessParams?: (entity: EntityTypes, params: TParams) => Record<string, string>;
  getErrorParams?: (error: Error, entity: EntityTypes, params: TParams) => Record<string, string>;
}

/**
 * Factory pour créer des hooks de mutation d'entités
 *
 * @example
 * export const useFollowEntity = createEntityMutation({
 *   action: (e) => e.follow(),
 *   i18n: { successKey: "toast.relationship.followSuccess", errorKey: "toast.relationship.followError" },
 *   invalidate: (e) => [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(e.slug)],
 * });
 */
export function createEntityMutation<TParams = void>(config: EntityMutationConfig<TParams>) {
  return function useEntityMutation(entity: EntityTypes | null) {
    const queryClient = useQueryClient();
    const { me } = useCocolight();

    return useMutationWithToast<void, TParams>({
      mutationFn: async (params) => {
        if (!entity) {
          throw new Error("No entity provided");
        }
        if (config.entityTypes) {
          const entityType = getEntityType(entity);
          if (!entityType || !config.entityTypes.includes(entityType)) {
            throw new Error(`Invalid entity type: expected ${config.entityTypes.join(" or ")}`);
          }
        }
        // ⚠️ NE PAS poser ici de scope costum sur l'entité (`ensureCostumScope`/`setCostumScope`).
        // Ces actions déclenchent bien des e-mails côté legacy (CONNECT / DISCONNECT / LINK_VALIDATE / FOLLOW), et c'est le
        // `costumSlug` de la requête qui décide du sujet, du logo, de l'expéditeur et du domaine des
        // liens — mais ce contexte est désormais posé UNE fois pour toutes sur le client API
        // (`applySiteCostum` → `ApiClient.setSiteCostum`, cf. src/lib/siteCostum.ts) et injecté par la
        // lib sur tout endpoint marqué `costumContext` au contrat.
        // Le poser en plus sur l'entité serait au mieux redondant, au pire NUISIBLE : `setCostumScope`
        // écrit AUSSI `_costumCtx`, qui gouverne le SCHÉMA D'ÉDITION de l'entité — on changerait donc
        // autre chose que le branding. Et la raison historique de le faire a disparu : depuis la
        // v1.0.192, le contexte de requête d'une entité ne lit plus que `_adminScope` (le scope POSÉ
        // explicitement), jamais `_costumCtx` (sa provenance) — une entité non scopée ne propose donc
        // plus rien et laisse s'appliquer le costum DU SITE, qui est la bonne réponse.
        await config.action(entity, params);
      },
      namespace: "modules/profil",
      successKey: config.i18n.successKey,
      errorKey: config.i18n.errorKey,
      getSuccessParams: config.getSuccessParams
        ? (_, params) => config.getSuccessParams!(entity!, params)
        : undefined,
      getErrorParams: config.getErrorParams
        ? (error, params) => config.getErrorParams!(error, entity!, params)
        : undefined,
      onSuccessCallback: () => {
        if (entity) {
          const keys = config.invalidate(entity, me as User | null);
          keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
          // Émission post-succès (additif) : les abonnés (ex. PreviewEvent) réagissent
          // « suivant le besoin » sans que les mutations connaissent leurs consommateurs.
          if (config.actionType) {
            emitEntityAction({ type: config.actionType, entity, me: me as User | null });
          }
        }
      },
      invalidateQueries: [],
    });
  };
}

/**
 * Configuration pour créer une mutation sur un User (dans le contexte d'une entité parente)
 * Utilisé pour les actions admin (promote, demote, remove, etc.)
 */
export interface UserMutationConfig {
  /** Action à exécuter sur le user */
  action: (user: User) => Promise<void>;
  /** Clés i18n pour les toasts */
  i18n: {
    successKey: string;
    errorKey: string;
  };
}

/**
 * Factory pour créer des hooks de mutation sur des Users (dans le contexte d'une entité)
 *
 * @example
 * export const usePromoteMember = createUserMutation({
 *   action: (user) => user.promoteToAdmin(),
 *   i18n: { successKey: "toast.members.promoteSuccess", errorKey: "toast.members.promoteError" },
 * });
 */
export function createUserMutation(config: UserMutationConfig) {
  return function useUserMutation(parentEntity: EntityTypes | null) {
    const queryClient = useQueryClient();

    return useMutationWithToast<void, User>({
      mutationFn: async (user) => {
        // ⚠️ NE PAS poser ici de scope costum sur l'entité (`ensureCostumScope`/`setCostumScope`).
        // Ces actions déclenchent bien des e-mails côté legacy (LINK_VALIDATE / CONNECT / DISCONNECT / DEMOTE_ADMIN), et c'est le
        // `costumSlug` de la requête qui décide du sujet, du logo, de l'expéditeur et du domaine des
        // liens — mais ce contexte est désormais posé UNE fois pour toutes sur le client API
        // (`applySiteCostum` → `ApiClient.setSiteCostum`, cf. src/lib/siteCostum.ts) et injecté par la
        // lib sur tout endpoint marqué `costumContext` au contrat.
        // Le poser en plus sur l'entité serait au mieux redondant, au pire NUISIBLE : `setCostumScope`
        // écrit AUSSI `_costumCtx`, qui gouverne le SCHÉMA D'ÉDITION de l'entité — on changerait donc
        // autre chose que le branding. Et la raison historique de le faire a disparu : depuis la
        // v1.0.192, le contexte de requête d'une entité ne lit plus que `_adminScope` (le scope POSÉ
        // explicitement), jamais `_costumCtx` (sa provenance) — une entité non scopée ne propose donc
        // plus rien et laisse s'appliquer le costum DU SITE, qui est la bonne réponse.
        await config.action(user);
      },
      namespace: "modules/profil",
      successKey: config.i18n.successKey,
      errorKey: config.i18n.errorKey,
      getSuccessParams: (_, user) => ({ name: user.serverData?.name || "" }),
      getErrorParams: (_, user) => ({ name: user.serverData?.name || "" }),
      onSuccessCallback: () => {
        if (parentEntity) {
          invalidateMemberQueries(queryClient, parentEntity);
        }
      },
      invalidateQueries: [],
    });
  };
}

/**
 * Invalide toutes les queries liées aux membres d'une entité
 */
export function invalidateMemberQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  entity: EntityTypes
): void {
  queryClient.invalidateQueries({ queryKey: PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug ?? null) });
  queryClient.invalidateQueries({ queryKey: PROFIL_QUERY_KEYS.SEARCH_USERS_PREFIX() });

  if (isOrganization(entity)) {
    queryClient.invalidateQueries({ queryKey: PROFIL_QUERY_KEYS.ORGANIZATION_MEMBERS_PREFIX(entity.slug ?? null) });
  } else if (isProject(entity)) {
    queryClient.invalidateQueries({ queryKey: PROFIL_QUERY_KEYS.PROJECT_CONTRIBUTORS_PREFIX(entity.slug ?? null) });
  } else if (isEvent(entity)) {
    queryClient.invalidateQueries({ queryKey: PROFIL_QUERY_KEYS.EVENT_ATTENDEES_PREFIX(entity.slug ?? null) });
  }
}
