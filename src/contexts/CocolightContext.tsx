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
}


export const CocolightContext = createContext<CocolightContextType | null>(null);
