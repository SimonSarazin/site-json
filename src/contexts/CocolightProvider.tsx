import Cocolight from "@communecter/cocolight-api-client";
import { useEffect, useState, ReactNode, useMemo } from "react";

import { InitApiOptions } from "../lib/apiClient";
import { getSlug } from "../lib/constant/common";
import { CocolightContext } from "./CocolightContext";
import { useCocolightInit } from "@/hooks/useCocolightInit";

// --- Types dérivés du SDK (grâce à nos déclarations d.ts) ------------------

type Api       = InstanceType<typeof Cocolight.Api>;

export interface CocolightProviderProps {
  children: ReactNode;
  clientOptions?: InitApiOptions;
}

const DEFAULT_CLIENT_OPTIONS: InitApiOptions = Object.freeze({});

export function CocolightProvider({ children, clientOptions = DEFAULT_CLIENT_OPTIONS }: CocolightProviderProps) {


    /* 1️⃣ — données initiales, déjà prêtes grâce à Suspense ---------------- */
  const {
    client,             // ApiClient           (stable)
    userApiInstance,    // UserApi             (stable)
    api:   initialApi,  // Api                 (mutable : login/logout)
    me:    initialMe,
    organization: initialOrg,
  } = useCocolightInit(clientOptions);

 
  useEffect(() => {
    // 🟢 Compte uniquement les commits RÉELS
    console.count('CocolightProvider commit');
  }, []);

  // ----------------------------- state ------------------------------------
  const [api,          setApi]          = useState<Api>(initialApi);
  const [me,           setMe]           = useState<any>(initialMe);
  const [organization, setOrganization] = useState<any>(initialOrg);
  // ------------------------- auxiliaires ----------------------------------
  const [dataToProfile, setDataToProfile] = useState<any>(null);

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

    userApiInstance.client.on("userLoggedIn", handleUserLoggedIn);
    userApiInstance.client.on("sessionReset", handleSessionReset);

    return () => {
      userApiInstance.client.off("userLoggedIn", handleUserLoggedIn);
      userApiInstance.client.off("sessionReset", handleSessionReset);
    };
  }, [userApiInstance?.client]);

  const contextValue = useMemo(
  () => ({
    apiClient : client,
    userApi   : userApiInstance,
    api, me, organization,
    helper    : (Cocolight as any).helper,
    dataToProfile,
    setDataToProfile,
    loading : false,
  }),
  [client, userApiInstance, api, me, organization, dataToProfile]
);

  return (
    <CocolightContext.Provider
      value={contextValue}
    >
      {children}
    </CocolightContext.Provider>
  );
}
