import Cocolight, { type Api, type Organization, type User, type Project } from "@communecter/cocolight-api-client";
import { useEffect, useState, ReactNode, useMemo, useCallback } from "react";

import { InitApiOptions } from "../lib/apiClient";
import { getSlug } from "../lib/constant/common";
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
