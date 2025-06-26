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
    on(arg0: string, handleUserLoggedIn: () => Promise<void>) {
      throw new Error("Method not implemented.");
    }
    off(arg0: string, handleUserLoggedIn: () => Promise<void>) {
      throw new Error("Method not implemented.");
    }
    constructor(options?: ApiClientOptions);

    readonly baseURL: string;
    readonly tokenStorageStrategy: TokenStorageStrategy;
    /** Vaut true quand un token valide est présent */
    isConnected: boolean;
  }

  /** Modèle utilisateur extrêmement simplifié */
  export interface User {
    id: string;
    name?: string;
    [key: string]: unknown;
  }

  /** Modèle organisation extrêmement simplifié */
  export interface Organization {
    id: string;
    slug: string;
    name?: string;
    [key: string]: unknown;
  }

  /** API de plus haut niveau : appels REST typiques */
  export class Api {
    constructor(user: User | null, client: ApiClient);

    me(): Promise<User>;
    organization(params: { slug: string }): Promise<Organization>;
  }

  /** API centrée sur l'utilisateur connecté */
  export class UserApi {
    constructor(client: ApiClient);

    readonly client: ApiClient;
    /** Retourne l'utilisateur actuellement connecté (ou erreur) */
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
  };

  export default Cocolight;
}
