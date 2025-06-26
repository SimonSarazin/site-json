// src/lib/constant/common.ts
/* -------------------------------------------------------------------------- */
/* 1.  Types & déclarations globales                                          */
/* -------------------------------------------------------------------------- */
export interface RuntimeEnv {
  VITE_BASE_URL_BACKEND?: string;
  VITE_SLUG?:             string;
  VITE_SERVER_URL?:       string;
}

/** Déclare window.__ENV__ pour le compilateur */
declare global {
  interface Window { __ENV__?: RuntimeEnv }
}

/* -------------------------------------------------------------------------- */
/* 2.  Enum – utile pour éviter les strings magiques                          */
/* -------------------------------------------------------------------------- */
export const enum ELEMENT_TYPE {
  citoyens      = "citoyens",
  projects      = "projects",
  organizations = "organizations",
  events        = "events",
}

/* -------------------------------------------------------------------------- */
/* 3.  Fabrique générique pour lire une var d’environnement                   */
/* -------------------------------------------------------------------------- */
function readEnv<K extends keyof RuntimeEnv>(
  key: K,
  fallback: string,
): string {
  //   navigateur                Node (CLI / SSR)            Vite (build)
  const value =
    (typeof window      !== "undefined" && window.__ENV__?.[key]) ??
    (typeof process     !== "undefined" && process.env?.[key])    ??
    (typeof import.meta !== "undefined" && (import.meta.env as RuntimeEnv)?.[key]);

  return (typeof value === "string" && value.length) ? value : fallback;
}

/* -------------------------------------------------------------------------- */
/* 4.  Helpers publics                                                        */
/* -------------------------------------------------------------------------- */
export const getBaseUrl  = () => readEnv("VITE_BASE_URL_BACKEND", "http://localhost:3000");
export const getSlug      = () => readEnv("VITE_SLUG",              "default");
export const getServerUrl = () => readEnv("VITE_SERVER_URL",        "http://localhost:3000");
