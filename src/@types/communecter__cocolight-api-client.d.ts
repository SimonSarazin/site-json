/*
 * Déclarations TypeScript minimalistes pour le paquet
 *   @communecter/cocolight-api-client (JS only)
 * ---------------------------------------------------
 * Ces types couvrent les symboles utilisés dans api-client.ts et offrent
 * une auto‑complétion de base.  Complète‑les au fur et à mesure que de
 * nouvelles méthodes/propriétés te sont nécessaires.
 */

declare module "@communecter/cocolight-api-client" {
  /** Back‑end de stockage supporté par la stratégie multi‑serveur */
  export type TokenBackend = "memory" | "localStorage" | (string & {});

  /** Interface très simplifiée d'une stratégie de stockage de jetons */
  export interface TokenStorageStrategy {
    getStorage(key: string): Promise<string | null>;
    setStorage(key: string, value: string): Promise<void>;
    removeStorage(key: string): Promise<void>;
  }

  /** Fabriques de stratégies de stockage */
  export namespace tokenStorageStrategy {
    function createDefaultMultiServerTokenStorageStrategy(
      backend: TokenBackend
    ): Promise<TokenStorageStrategy>;
  }

  /** Options du constructeur ApiClient */
  export interface ApiClientOptions {
    baseURL?: string;
    debug?: boolean;
    tokenStorageStrategy?: TokenStorageStrategy;
    /** Index signature pour accepter les options additionnelles */
    [key: string]: unknown;
  }

  /** Client HTTP bas niveau partagé par toutes les API */
  export class ApiClient {
  on (event: string, listener: (...args: unknown[]) => void): void;
  off(event: string, listener: (...args: unknown[]) => void): void;
    constructor(options?: ApiClientOptions);

    readonly baseURL: string;
    readonly tokenStorageStrategy: TokenStorageStrategy;
    /** Vaut true quand un token valide est présent */
    isConnected: boolean;
  }

  export interface SearchResultPage<T = unknown> {
    /** Le tableau brut de résultats JSON */
    results: T;
    /** Numéro de la page */
    pageNumber: number;
    /** Indique s’il reste une page suivante */
    hasNext: boolean;
    /** Récupère la page suivante si hasNext = true */
    next: () => Promise<SearchResultPage<T>>;
  }

  export interface CocolightHelper {
  /**
   * Transforme une entité brute (JSON) en entité riche Cocolight.
   * T est souvent un type dérivé de User | Organization | etc.
   */
  fromEntityJSON: <T = unknown>(raw: any, org: Organization) => T;
  // …vous pourrez ajouter d’autres helpers ici…
}

  /** Modèle utilisateur extrêmement simplifié */
  export interface User {
    id: string;
    name?: string;
    email?: string;

    serverData?: {
      roles?: string[];
      name?: string;
      email?: string;
      [key: string]: unknown;
    };
    organization(params: { slug: string }): Promise<Organization>;

    [key: string]: unknown;
  }

  /** Modèle organisation extrêmement simplifié */
  export interface Organization {
    id: string;
    slug: string;
    name?: string;
    [key: string]: unknown;

    /** Recherche «costum» paginée */
    searchCostum<T = unknown>(params: Record<string, any>): Promise<SearchResultPage<T>>;

    /** Récupère une entité par slug */
    entityBySlug<T = unknown>(slug: string): Promise<T>;
  }

  /** API de plus haut niveau : appels REST typiques */
  export class Api {
    constructor(user: User | null, client: ApiClient);

    me(): Promise<User>;
    organization(params: { slug: string }): Promise<Organization>;


    /** Déconnexion */
    logout(): void;
  }

  /** API centrée sur l'utilisateur connecté */
  export class UserApi {
    constructor(client: ApiClient);

    readonly client: ApiClient;
    /** Retourne l'utilisateur actuellement connecté (ou erreur) */
    readonly isConnected: boolean;

        /** Authentification : renvoie l’utilisateur connecté */
    login(
      email: string,
      password: string,
      options?: { remember?: boolean }
    ): Promise<User>;

    /**
     * Inscription : renvoie un objet de forme
     * { result: boolean; errId?: string; msg?: string }
     */
    register(params: {
      name: string;
      username: string;
      email: string;
      pwd: string;
      [key: string]: unknown;
    }): Promise<{
      result: boolean;
      errId?: string;
      msg?: string;
    }>;

    /** Demande de réinitialisation de mot de passe */
    recoverPassword(email: string): Promise<{
      result: boolean;
      errId?: string;
      msg?: string;
    }>;

    /** Ancienne méthode existante */
    meIsconnected(): Promise<User>;
  }

  /** Espace de noms additionnel accroché à `Api` dans le runtime */
  export namespace ApiNamespace {
    function userApi(client: ApiClient): UserApi;
    // Classe pour conserver la parité avec l'implémentation JS
    class userApi extends UserApi {}
  }

  /** Export principal reconstitué */
  const Cocolight: {
    ApiClient: typeof ApiClient;
    Api: typeof Api & typeof ApiNamespace;
    tokenStorageStrategy: typeof tokenStorageStrategy;
    helper: CocolightHelper;
  };

  export default Cocolight;
}
