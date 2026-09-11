import Cocolight, { type Api, type Organization, type User, type Project } from "@communecter/cocolight-api-client";
import { useEffect, useState, ReactNode, useMemo, useCallback } from "react";

import { InitApiOptions } from "../lib/apiClient";
import { getSlug } from "../lib/constant/common";
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

    eventfulClient.on("userLoggedIn", handleUserLoggedIn);
    eventfulClient.on("sessionReset", handleSessionReset);

    return () => {
      eventfulClient.off("userLoggedIn", handleUserLoggedIn);
      eventfulClient.off("sessionReset", handleSessionReset);
    };
  }, [userApiInstance]);

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
    }),
    [client, userApiInstance, api, me, contextType, contextId, entity, dataToProfile, refreshMe],
  );

  return (
    <CocolightContext.Provider value={contextValue}>
      {children}
    </CocolightContext.Provider>
  );
}
