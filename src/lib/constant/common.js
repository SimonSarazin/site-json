export const ELEMENT_TYPE = {
  citoyens: "citoyens",
  projects: "projects",
  organizations: "organizations",
  events: "events"
};

export function getBaseUrl() {
  if (typeof window !== "undefined" && window.__ENV__?.VITE_BASE_URL_BACKEND) {
    return window.__ENV__.VITE_BASE_URL_BACKEND;
  }
  if (typeof process !== "undefined" && process.env?.VITE_BASE_URL_BACKEND) {
    return process.env.VITE_BASE_URL_BACKEND;
  }
  // Fallback for SSR
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_BASE_URL_BACKEND) {
    return import.meta.env.VITE_BASE_URL_BACKEND;
  }
  return "http://localhost:3000"; // Default fallback
}

export function getSlug() {
  if (typeof window !== "undefined" && window.__ENV__?.VITE_SLUG) {
    return window.__ENV__.VITE_SLUG;
  }
  if (typeof process !== "undefined" && process.env?.VITE_SLUG) {
    return process.env.VITE_SLUG;
  }
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_SLUG) {
    return import.meta.env.VITE_SLUG;
  }
  return "default"; // Default fallback
}

export function getServerUrl() {
  if (typeof window !== "undefined" && window.__ENV__?.VITE_SERVER_URL) {
    return window.__ENV__.VITE_SERVER_URL;
  }
  if (typeof process !== "undefined" && process.env?.VITE_SERVER_URL) {
    return process.env.VITE_SERVER_URL;
  }
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }
  return "http://localhost:3000"; // Default fallback
}