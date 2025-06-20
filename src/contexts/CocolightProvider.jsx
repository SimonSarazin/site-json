// CocolightProvider.jsx
import Cocolight from "@communecter/cocolight-api-client";
import React, { useEffect, useState } from "react";


import { initApiClient } from "./apiClient";
import { getSlug } from "./constant/common";
import { CocolightContext } from "./context/CocolightContext";

export function CocolightProvider({ children, clientOptions = {}, initialOrganization  }) {
  const [apiClient, setApiClient] = useState(null);
  const [userApi, setUserApi] = useState(null);
  const [api, setApi] = useState(null);
  const [me, setMe] = useState(null);
  const [organization, setOrganization] = useState(initialOrganization ?? null);
  const [loading, setLoading] = useState(initialOrganization ? false : true);

  useEffect(() => {
    async function init() {
      const { client, userApiInstance, me, api, organization } = await initApiClient(clientOptions);
      setApiClient(client);
      setUserApi(userApiInstance);
      setMe(me);
      setOrganization(organization);
      setApi(api);
      setLoading(false);
    }

    init();
  }, [clientOptions]);

  // 🛠 écoute des événements du client
  useEffect(() => {
    if (!userApi || loading) return;

    const handleUserLoggedIn = async () => {
      try {
        const loggedUser = await userApi.meIsconnected();
        const refreshedApi = new Cocolight.Api(loggedUser, userApi.client);
        const me = await refreshedApi.me();
        const slug = getSlug();
        const organization = await me.organization({ slug: slug });
        setMe(me);
        setApi(refreshedApi);
        setOrganization(organization);
      } catch (error) {
        console.error("Erreur après login :", error);
      }
    };

    const handleSessionReset = async () => {
      setMe(null);
      setApi(new Cocolight.Api(null, userApi.client));
    };

    userApi.client.on("userLoggedIn", handleUserLoggedIn);
    userApi.client.on("sessionReset", handleSessionReset);

    return () => {
      userApi.client.off("userLoggedIn", handleUserLoggedIn);
      userApi.client.off("sessionReset", handleSessionReset);
    };
  }, [userApi, loading]);

  const [dataToProfile, setDataToProfile] = useState(null);

  return (
    <CocolightContext.Provider value={{ 
      apiClient, 
      userApi, 
      loading, 
      me, 
      api, 
      organization, 
      helper: Cocolight.helper, 
      dataToProfile,
      setDataToProfile 
    }}>
      {children}
    </CocolightContext.Provider>
  );
}
