import Cocolight, { User, Organization } from "@communecter/cocolight-api-client";
import { useEffect, useState, ReactNode, useMemo } from "react";

import { InitApiOptions } from "../lib/apiClient";
import { getSlug } from "../lib/constant/common";
import { CocolightContext } from "./CocolightContext";
import { useCocolightInit } from "@/hooks/useCocolightInit";

// ---------------------------------------------------------------------------
// Types dérivés du SDK -------------------------------------------------------
// ---------------------------------------------------------------------------

type Api = InstanceType<typeof Cocolight.Api>;
/** Ajout des méthodes EventEmitter manquantes au typage */
interface ApiClientWithEvents extends InstanceType<typeof Cocolight.ApiClient> {
  on(event: string, listener: (...args: unknown[]) => void): void;
  off(event: string, listener: (...args: unknown[]) => void): void;
}

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
  } = useCocolightInit(clientOptions);

  useEffect(() => {
    // 🟢 Compte uniquement les commits RÉELS
    console.count("CocolightProvider commit");
  }, []);

  // ----------------------------- state ------------------------------------
  const [api, setApi] = useState<Api>(initialApi);
  const [me, setMe] = useState<User | null>(initialMe as User | null);
  const [organization, setOrganization] = useState<Organization | null>(
    initialOrg as Organization | null,
  );
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
        const organization = await me.organization({ slug });
        setMe(me);
        setApi(refreshedApi);
        setOrganization(organization);
      } catch (error) {
        console.error("Erreur après login :", error);
      }
    };

    const handleSessionReset = async () => {
      setMe(null);
      if (userApiInstance?.client) {
        setApi(new Cocolight.Api(null, userApiInstance.client));
      }
    };

    // Le client implémente en runtime EventEmitter, mais pas dans les d.ts
    const eventfulClient = userApiInstance.client as ApiClientWithEvents;

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
      helper: (Cocolight as unknown as { helper: unknown }).helper,
      dataToProfile,
      setDataToProfile,
      loading: false,
    }),
    [client, userApiInstance, api, me, organization, dataToProfile],
  );

  return (
    <CocolightContext.Provider value={contextValue}>
      {children}
    </CocolightContext.Provider>
  );
}
