import Cocolight, { type Api, type ApiClient, type UserApi, type Organization, type User, Project, } from "@communecter/cocolight-api-client";
import { createContext, Dispatch, SetStateAction } from "react";

type CocolightHelper = typeof Cocolight.helper;

export interface CocolightContextType {
  /** Client HTTP bas niveau partagé par toutes les API */
  apiClient: ApiClient | null
  /** Facade utilisateur (login / logout / etc.) */
  userApi: UserApi | null
  /** Indique si l'initialisation est en cours */
  loading: boolean
  /** Utilisateur actuellement connecté (null si anonyme) */
  me: User | null
  /** API haut niveau REST, instanciée après login */
  api: Api | null
  /** Type de contexte résolu depuis le slug (organizations, projects, etc.) */
  contextType?: string
  /** ID du contexte résolu depuis le slug */
  contextId?: string
  /** Entité complète (organization, project, event, etc.) */
  entity: Organization | Project | null
  /** Helpers divers exposés par le SDK (pas encore typés) */
  helper: CocolightHelper
  /** Données temporaires transmises au profil */
  dataToProfile: unknown
  setDataToProfile: Dispatch<SetStateAction<unknown>>
  /** Recharge les données de l'utilisateur connecté depuis l'API */
  refreshMe: () => Promise<void>
  /**
   * Recharge l'entité porteuse du site depuis l'API — et donc son `costum`,
   * que `element/about` renvoie avec elle. À appeler après une écriture sur le
   * costum (création/suppression d'un ampli) : l'entité est du STATE ici, pas
   * une query, une invalidation React Query ne la rafraîchirait pas.
   */
  refreshEntity: () => Promise<void>
}


export const CocolightContext = createContext<CocolightContextType | null>(null);
