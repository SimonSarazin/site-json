/* -------------------------------------------------------------
 * Dynamic Leaflet + MarkerCluster loader (client‑side only)
 * -------------------------------------------------------------
 * Usage:
 *   const L = await loadLeaflet();
 *   const map = L.map("id");
 * -----------------------------------------------------------*/

// We keep a single shared promise to avoid duplicate imports.
let leafletPromise: Promise<typeof import("leaflet")> | undefined;

/**
 * Dynamically loads Leaflet and its MarkerCluster plugin.
 * Throws if called on the server.
 */
export async function loadLeaflet(): Promise<typeof import("leaflet")> {
  if (typeof window === "undefined") {
    throw new Error("❌ loadLeaflet ne peut être utilisé qu’au client");
  }

  if (!leafletPromise) {
    leafletPromise = (async () => {
      // 1. Load core Leaflet library and CSS
      const leafletModule = await import("leaflet");
      const L = leafletModule.default ?? leafletModule;

      await import("leaflet/dist/leaflet.css");

      // 2. Expose Leaflet globally for plugins that expect window.L
      //    (MarkerCluster still relies on a global reference)
      //    We cast window to any to avoid global augmentation boilerplate.
      (window as any).L = L;

      // 3. Load MarkerCluster JS + CSS once Leaflet is on window
      await import("leaflet.markercluster");
      await import("leaflet.markercluster/dist/MarkerCluster.css");
      await import("leaflet.markercluster/dist/MarkerCluster.Default.css");

      return L;
    })();
  }

  return leafletPromise;
}

// If you want to use `window.L` with proper typing elsewhere, you can augment
// the global Window interface like so (uncomment if needed):
// declare global {
//   interface Window {
//     L: typeof import("leaflet");
//   }
// }
