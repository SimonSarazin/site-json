import Cocolight, { type Api, type Organization, type User, type Project } from "@communecter/cocolight-api-client";
import { useEffect, useState, ReactNode, useMemo, useCallback } from "react";

import { InitApiOptions } from "../lib/apiClient";
import { getBaseUrl, getSlug } from "../lib/constant/common";
import { applySiteCostum } from "../lib/siteCostum";
import { CocolightContext } from "./CocolightContext";
import { useCocolightInit } from "@/hooks/useCocolightInit";

// ---------------------------------------------------------------------------
// Types dérivés du SDK -------------------------------------------------------
// ---------------------------------------------------------------------------

export interface CocolightProviderProps {
  children: ReactNode;
  clientOptions?: InitApiOptions;
}

const DEFAULT_CLIENT_OPTIONS: InitApiOptions = Object.freeze({});

export function CocolightProvider({
  children,
  clientOptions = DEFAULT_CLIENT_OPTIONS,
}: CocolightProviderProps) {

    /* 1️⃣ — données initiales, déjà prêtes grâce à Suspense ---------------- */
  const {
    client, // ApiClient           (stable)
    userApiInstance, // UserApi             (stable)
    api: initialApi, // Api                 (mutable : login/logout)
    me: initialMe,
    contextType: initialContextType,
    contextId: initialContextId,
    entity: initialEntity,
  } = useCocolightInit(clientOptions);

  useEffect(() => {
    // 🟢 Compte uniquement les commits RÉELS
    if (import.meta.env.DEV) {
      console.count("CocolightProvider commit");
    }
  }, []);

  // ----------------------------- state ------------------------------------
  const [api, setApi] = useState<Api | null>(initialApi);
  const [me, setMe] = useState<User | null>(initialMe as User | null);
  const [entity, setEntity] = useState<Organization | Project | null>(
    initialEntity as Organization | Project | null,
  );
  const [contextType, setContextType] = useState<string | undefined>(initialContextType);
  const [contextId, setContextId] = useState<string | undefined>(initialContextId);
  // ------------------------- auxiliaires ----------------------------------
  const [dataToProfile, setDataToProfile] = useState<unknown>(null);

  // ------------------- listeners (login / session) ------------------------
  useEffect(() => {
    if (!userApiInstance?.client) return;

    const handleUserLoggedIn = async () => {
      try {
        const loggedUser = await userApiInstance.meIsconnected();
        const refreshedApi = new Cocolight.Api(loggedUser, userApiInstance.client);
        const me = await refreshedApi.me();
        const slug = getSlug();

        // Résolution générique du slug via entityBySlug
        if (slug) {
          try {
            const resolvedEntity = await me.entityBySlug(slug);

            if (resolvedEntity) {
              const resolvedContextType = resolvedEntity.getEntityType();
              const resolvedContextId = resolvedEntity.id || undefined;

              setEntity(resolvedEntity);
              setContextType(resolvedContextType);
              setContextId(resolvedContextId);

            }
          } catch (slugErr) {
            console.error("[CocolightProvider] Erreur lors de la résolution du slug:", slugErr);
          }
        }

        setMe(me);
        setApi(refreshedApi);
      } catch (error) {
        console.error("Erreur après login :", error);
      }
    };

    const handleSessionReset = async () => {
      setMe(null);
      if (userApiInstance?.client) {
        const apiReset = new Cocolight.Api(null, userApiInstance.client);
        setApi(apiReset);
        const slug = getSlug();
        const resolvedEntity = await apiReset.entitySlug(slug);
        setEntity(resolvedEntity as Organization | Project);
      }
    };

    // Le client implémente en runtime EventEmitter, mais pas dans les d.ts
    const eventfulClient = userApiInstance.client;

    // Connexion faite dans un AUTRE onglet du même navigateur — retour SSO hors popup : le lien de
    // vérification d'e-mail du provider s'ouvre dans un nouvel onglet, qui termine la connexion sur
    // /sso/callback (SsoCallbackPage). Les jetons arrivent ici par le stockage local partagé
    // (`cocolight_tokens_<backend>`, MultiServerTokenStorageStrategy), mais le client de CET onglet
    // ne lit que sa mémoire (`isConnected` = jeton en mémoire) : la page de login restait affichée
    // jusqu'à un rechargement. On recharge les jetons et on rejoue `userLoggedIn`, comme si le login
    // avait eu lieu ici. `storage` ne se déclenche que dans les AUTRES onglets, jamais dans l'émetteur.
    //
    // Deux subtilités : (1) la clé est celle de CE backend (`cocolight_tokens_<baseURL>`), pas n'importe
    // quelle clé `cocolight_tokens_*` (deux fronts sur la même origine ne doivent pas se mélanger) ;
    // (2) la lib écrit access puis refresh en DEUX écritures, donc deux événements — le second arrive
    // alors qu'on est déjà connecté. On mémorise qu'un refresh est attendu et on l'adopte s'il diffère
    // de celui déjà pris ; sans cette attente, l'onglet d'origine vivrait 10 min sans refresh. L'onglet
    // émetteur, lui, est déjà connecté au premier événement et n'attend rien : aucun ping-pong d'écritures.
    const tokensKey = `cocolight_tokens_${clientOptions.baseURL ?? getBaseUrl()}`;
    let refreshAttendu: string | null = null;
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== tokensKey || !e.newValue) return;
      let data: { accessToken?: string; refreshToken?: string };
      try {
        data = JSON.parse(e.newValue);
      } catch {
        return; // valeur illisible : le prochain rechargement relira le stockage
      }
      const { accessToken, refreshToken } = data;
      if (!accessToken) return;
      if (eventfulClient.isConnected) {
        if (refreshAttendu !== null && refreshToken && refreshToken !== refreshAttendu) {
          refreshAttendu = null;
          eventfulClient.setRefreshToken(refreshToken);
        }
        return;
      }
      eventfulClient.setToken(accessToken);
      if (refreshToken) eventfulClient.setRefreshToken(refreshToken);
      refreshAttendu = refreshToken ?? "";
      eventfulClient.emit("userLoggedIn");
    };

    eventfulClient.on("userLoggedIn", handleUserLoggedIn);
    eventfulClient.on("sessionReset", handleSessionReset);
    window.addEventListener("storage", handleStorage);

    return () => {
      eventfulClient.off("userLoggedIn", handleUserLoggedIn);
      eventfulClient.off("sessionReset", handleSessionReset);
      window.removeEventListener("storage", handleStorage);
    };
  }, [userApiInstance, clientOptions.baseURL]);

  // ------------- identité costum du site portée par le client -------------
  // Le client la reçoit déjà à sa construction (apiClient.ts), mais `contextId`/`contextType`
  // viennent d'une résolution RÉSEAU : ils arrivent après, et sont RE-résolus à chaque login /
  // reset de session (handlers ci-dessus). On repose donc le trio à chaque changement — appel
  // idempotent, synchrone, sans réseau. Dans un effet et pas au rendu : muter le client est un
  // effet de bord, que react-compiler interdit pendant le rendu.
  // `getSlug()` (VITE_SLUG) est une valeur de PROCESSUS — 1 processus = 1 site — donc le singleton
  // de client de `apiClient.ts` ne peut pas mélanger deux identités costum.
  useEffect(() => {
    applySiteCostum(client, { contextId, contextType });
  }, [client, contextId, contextType]);

  // ------------------- refresh me ----------------------------------------
  const refreshMe = useCallback(async () => {
    if (!api) return;
    try {
      const freshMe = await api.me();
      setMe(freshMe);
    } catch (e) {
      console.error("[CocolightProvider] refreshMe failed:", e);
    }
  }, [api]);

  // ------------------- refresh entity -------------------------------------
  /**
   * Recharge l'élément porteur du site. Sert après une écriture sur le costum
   * (`createAmpli` / `removeAmpli`) : `costum` arrive AVEC l'entité
   * (`element/about`), et l'entité est du state — aucune invalidation React
   * Query ne la remettrait à jour.
   *
   * Une NOUVELLE instance et pas `entity.get()` : ce dernier met `serverData` à
   * jour en place, sans changer l'identité de l'objet, donc sans rendu.
   * Résolution identique aux écouteurs de session : connecté →
   * `me.entityBySlug` (l'entité porte alors les liens dont dépendent les
   * droits), anonyme → `api.entitySlug`.
   */
  const refreshEntity = useCallback(async () => {
    const slug = getSlug();
    if (!slug) return;
    try {
      const resolved = me
        ? await me.entityBySlug(slug)
        : await api?.entitySlug(slug);
      if (!resolved) return;
      const refreshed = resolved as Organization | Project;
      setEntity(refreshed);
      setContextType(refreshed.getEntityType());
      setContextId(refreshed.id || undefined);
    } catch (e) {
      console.error("[CocolightProvider] refreshEntity failed:", e);
    }
  }, [api, me]);

  // ------------------------- Memo du contexte -----------------------------
  const contextValue = useMemo(
    () => ({
      apiClient: client,
      userApi: userApiInstance,
      api,
      me,
      contextType,
      contextId,
      entity,
      helper: Cocolight.helper,
      dataToProfile,
      setDataToProfile,
      loading: false,
      refreshMe,
      refreshEntity,
    }),
    [client, userApiInstance, api, me, contextType, contextId, entity, dataToProfile, refreshMe, refreshEntity],
  );

  return (
    <CocolightContext.Provider value={contextValue}>
      {children}
    </CocolightContext.Provider>
  );
}
