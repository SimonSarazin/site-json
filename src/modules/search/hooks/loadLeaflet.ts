/* -------------------------------------------------------------
 * Dynamic Leaflet loader (client‑side only)
 * -------------------------------------------------------------
 * Usage:
 *   const L = await loadLeaflet();
 *   const map = L.map("id");
 *
 * NB : le plugin MarkerCluster n'est plus chargé — la carte search est passée
 * à MapLibre + supercluster, et la carte profil (ProfileMapLeaflet) ne
 * clusterise pas. `leaflet.markercluster` a été retiré des dépendances.
 * -----------------------------------------------------------*/

// We keep a single shared promise to avoid duplicate imports.
let leafletPromise: Promise<typeof import("leaflet")> | undefined;

/**
 * Dynamically loads Leaflet (client only). Throws if called on the server.
 */
export async function loadLeaflet(): Promise<typeof import("leaflet")> {
  if (typeof window === "undefined") {
    throw new Error("❌ loadLeaflet ne peut être utilisé qu’au client");
  }

  if (!leafletPromise) {
    leafletPromise = (async () => {
      // Load core Leaflet library and CSS
      const leafletModule = await import("leaflet");
      const L = leafletModule.default ?? leafletModule;

      await import("leaflet/dist/leaflet.css");

      // Expose Leaflet globally (plugins / debug helpers qui attendent window.L)
      window.L = L;

      return L;
    })();
  }

  return leafletPromise;
}

// Augment the global Window interface to include Leaflet
declare global {
  interface Window {
    L: typeof import("leaflet");
  }
}
