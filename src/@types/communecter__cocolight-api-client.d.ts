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
    count?: Record<string, number>;
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

  export interface GlobalAutocompleteCostumData {
  /**
   * Nom ou mot-clé de la recherche
   */
  name?: string;
  /**
   * Liste des localités ciblées avec leur identifiant et leur type (city ou level1)
   */
  locality?: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^[^\s]+$".
     */
    [k: string]: {
      /**
       * Identifiant de la localité
       */
      id: string;
      /**
       * Type de la localité : 'cities' pour une ville ou 'level1' pour une région
       */
      type: "cities" | "level1";
    };
  };
  /**
   * Types d'entités à inclure dans la recherche
   */
  searchType: (
    | "NGO"
    | "LocalBusiness"
    | "Group"
    | "GovernmentOrganization"
    | "Cooperative"
    | "organizations"
    | "projects"
    | "events"
    | "citoyens"
    | "poi"
  )[];
  /**
   * Balises (tags) à utiliser pour filtrer la recherche
   */
  searchTags?: string[];
  /**
   * Liste fixe des types à compter dans les résultats
   */
  countType: (
    | "NGO"
    | "LocalBusiness"
    | "Group"
    | "GovernmentOrganization"
    | "Cooperative"
    | "organizations"
    | "projects"
    | "events"
    | "citoyens"
    | "poi"
  )[];
  /**
   * Critère de recherche (actuellement vide)
   */
  searchBy?: "ALL";
  /**
   * Index de départ global pour la pagination
   */
  indexMin: number;
  /**
   * Index de fin global pour la pagination
   */
  indexMax?: number;
  /**
   * Nombre d’éléments à récupérer (limite de pagination)
   */
  indexStep: number;
  /**
   * Configuration des plages de résultats pour chaque type de recherche
   */
  ranges?: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^[^\s]+$".
     */
    [k: string]: {
      /**
       * Index de départ pour la pagination
       */
      indexMin: number;
      /**
       * Index de fin pour la pagination
       */
      indexMax: number;
    };
  };
  /**
   * Type initial de la recherche, vide par défaut
   */
  initType: "";
  /**
   * Indique si les types doivent être comptés dans les résultats
   */
  count: true;
  /**
   * Filtres additionnels appliqués à la recherche (objet ou chaîne vide)
   */
  filters?:
    | {
        [k: string]: unknown;
      }
    | "";
  /**
   * Liste des champs à retourner
   */
  fields?: string[];
  /**
   * Champ de tri (clé = champ, valeur = 1 ou -1)
   */
  sortBy?: {
    [k: string]: 1 | -1;
  };
  /**
   * Indique si la recherche doit s'étendre au Fediverse (toujours désactivé)
   */
  fediverse: boolean;
  /**
   * Indique si la recherche est effectuée à partir d'une carte (toujours désactivé)
   */
  mapUsed?: true;
  /**
   * Indique si on doit exclure les éléments avec une source
   */
  notSourceKey?: true;
  /**
   * ID du contexte de recherche (actuellement vide)
   */
  contextId?: string;
  /**
   * Type de contexte de recherche (actuellement vide)
   */
  contextType?: "projects" | "organizations";
  /**
   * Slug du costume utilisé pour la recherche
   */
  costumSlug: string;
  /**
   * Clés de source pour la recherche
   */
  sourceKey?: string[];
  /**
   * Indique si le mode d'édition du costume est activé (toujours désactivé)
   */
  costumEditMode: boolean;
  options?: {
    tags?: {
      /**
       * Verbe d'action pour le filtre de recherche
       */
      verb?: string;
      [k: string]: unknown;
    };
    [k: string]: unknown;
  };
  [k: string]: unknown;
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
