import Cocolight, { CocolightHelper, Organization, User } from "@communecter/cocolight-api-client";
import { createContext, Dispatch, SetStateAction } from "react";

type ApiClient = InstanceType<typeof Cocolight.ApiClient>
/** Facade dédiée aux opérations utilisateur / auth */
type UserApi = ReturnType<typeof Cocolight.Api.userApi>
type Api = InstanceType<typeof Cocolight.Api>

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
  /** Organisation courante, déduite du slug */
  organization: Organization | null
  /** Helpers divers exposés par le SDK (pas encore typés) */
  helper: CocolightHelper
  /** Données temporaires transmises au profil */
  dataToProfile: unknown
  setDataToProfile: Dispatch<SetStateAction<unknown>>
}


export const CocolightContext = createContext<CocolightContextType | null>(null);
