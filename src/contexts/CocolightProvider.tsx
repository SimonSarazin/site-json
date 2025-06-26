import Cocolight from "@communecter/cocolight-api-client";
import { useEffect, useState, ReactNode } from "react";

import { initApiClient, InitApiOptions, InitApiResult } from "../lib/apiClient";
import { getSlug } from "../lib/constant/common";
import { CocolightContext } from "./CocolightContext";

// --- Types dérivés du SDK (grâce à nos déclarations d.ts) ------------------

type ApiClient = InstanceType<typeof Cocolight.ApiClient>;
type UserApi   = ReturnType<typeof Cocolight.Api.userApi>;
type Api       = InstanceType<typeof Cocolight.Api>;

export interface CocolightProviderProps {
  children: ReactNode;
  clientOptions?: InitApiOptions;
}

export function CocolightProvider({ children, clientOptions = {} }: CocolightProviderProps) {
  // ----------------------------- state ------------------------------------
  const [apiClient,    setApiClient]    = useState<ApiClient | null>(null);
  const [userApi,      setUserApi]      = useState<UserApi   | null>(null);
  const [api,          setApi]          = useState<Api       | null>(null);
  const [me,           setMe]           = useState<any>(null);
  const [organization, setOrganization] = useState<any>(null);
  const [loading,      setLoading]      = useState<boolean>(true);

  // ------------------------- initialisation ------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { client, userApiInstance, me, api, organization }: InitApiResult = await initApiClient(clientOptions);
        if (cancelled) return;
        setApiClient(client);
        setUserApi(userApiInstance);
        setMe(me);
        setOrganization(organization);
        setApi(api);
      } catch (error) {
        console.error("Error initializing Cocolight:", error);
        if (cancelled) return;
        setMe(null);
        setOrganization(null);
        setApi(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientOptions]);

  // ------------------- listeners (login / session) ------------------------
  useEffect(() => {
    if (!userApi || loading) return;

    const handleUserLoggedIn = async () => {
      try {
        const loggedUser = await userApi.meIsconnected();
        const refreshedApi = new Cocolight.Api(loggedUser, userApi.client);
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
      if (userApi?.client) {
        setApi(new Cocolight.Api(null, userApi.client));
      }
    };

    userApi.client.on("userLoggedIn", handleUserLoggedIn);
    userApi.client.on("sessionReset", handleSessionReset);

    return () => {
      userApi.client.off("userLoggedIn", handleUserLoggedIn);
      userApi.client.off("sessionReset", handleSessionReset);
    };
  }, [userApi, loading]);

  // ------------------------- auxiliaires ----------------------------------
  const [dataToProfile, setDataToProfile] = useState<any>(null);

  return (
    <CocolightContext.Provider
      value={{
        apiClient,
        userApi,
        loading,
        me,
        api,
        organization,
        helper: (Cocolight as any).helper, // taper finement dans le .d.ts si besoin
        dataToProfile,
        setDataToProfile,
      }}
    >
      {children}
    </CocolightContext.Provider>
  );
}
