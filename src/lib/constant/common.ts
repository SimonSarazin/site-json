// src/lib/constant/common.ts
/* -------------------------------------------------------------------------- */
/* 1.  Types & déclarations globales                                          */
/* -------------------------------------------------------------------------- */
export interface RuntimeEnv {
  VITE_BASE_URL_BACKEND?: string;
  VITE_SLUG?:             string;
  VITE_SERVER_URL?:       string;
  VITE_MON_API_KEY?:      string;
  VITE_MON_DOMAIN?:       string;
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
  const value =
    (typeof window      !== "undefined" ? window.__ENV__?.[key]              : undefined) ??
    (typeof process     !== "undefined" ? process.env?.[key]                 : undefined) ??
    (typeof import.meta !== "undefined" ? (import.meta.env as RuntimeEnv)?.[key] : undefined);

  return typeof value === "string" && value.length ? value : fallback;
}

/* -------------------------------------------------------------------------- */
/* 4.  Helpers publics                                                        */
/* -------------------------------------------------------------------------- */
export const getBaseUrl  = () => readEnv("VITE_BASE_URL_BACKEND", "http://localhost:3000");
export const getSlug      = () => readEnv("VITE_SLUG",              "default");
export const getServerUrl = () => readEnv("VITE_SERVER_URL",        "http://localhost:3000");
export const getMonApiKey = () => readEnv("VITE_MON_API_KEY",       "default-api-key");
export const getMonDomain = () => readEnv("VITE_MON_DOMAIN",        "default-domain.com");
