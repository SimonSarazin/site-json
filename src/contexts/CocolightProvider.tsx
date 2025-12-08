import Cocolight, { type Api, type Organization, type User, type Project } from "@communecter/cocolight-api-client";
import { useEffect, useState, ReactNode, useMemo } from "react";

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
    organization: initialOrg,
    contextType: initialContextType,
    contextId: initialContextId,
    entity: initialEntity,
  } = useCocolightInit(clientOptions);

  useEffect(() => {
    // 🟢 Compte uniquement les commits RÉELS
    console.count("CocolightProvider commit");
  }, []);

  // ----------------------------- state ------------------------------------
  const [api, setApi] = useState<Api | null>(initialApi);
  const [me, setMe] = useState<User | null>(initialMe as User | null);
  const [organization, setOrganization] = useState<Organization | null>(
    initialOrg as Organization | null,
  );
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

              if (resolvedContextType === "organizations") {
                setOrganization(resolvedEntity as Organization);
              }
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

  // ------------------------- Memo du contexte -----------------------------
  const contextValue = useMemo(
    () => ({
      apiClient: client,
      userApi: userApiInstance,
      api,
      me,
      organization,
      contextType,
      contextId,
      entity,
      helper: Cocolight.helper,
      dataToProfile,
      setDataToProfile,
      loading: false,
    }),
    [client, userApiInstance, api, me, organization, contextType, contextId, entity, dataToProfile],
  );

  return (
    <CocolightContext.Provider value={contextValue}>
      {children}
    </CocolightContext.Provider>
  );
}
