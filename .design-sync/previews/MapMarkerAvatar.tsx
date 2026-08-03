import type { CSSProperties } from "react";
import { MapMarkerAvatar } from "site-forge";

// Marqueur « vignette ronde de l'item » (map.marker.useItemImage) — composant
// React (pas une chaîne HTML Leaflet) : <img> 36px arrondi, anneau
// var(--background). Le style vit dans src/modules/search/styles.css (chunk
// lazy absent du CSS du bundle DS) → classe réinjectée à l'identique.
const markerCss = `
.search-map-marker-btn{padding:0;border:0;background:none;line-height:0;cursor:pointer}
.search-map-marker-btn.is-focused{position:relative;z-index:10}
.search-map-marker-btn.is-focused>*{transform:scale(1.4);filter:drop-shadow(0 0 2px var(--primary)) drop-shadow(0 0 5px var(--primary))}
.search-map-avatar{display:block;width:36px;height:36px;border-radius:9999px;border:2px solid var(--background);box-shadow:0 1px 4px rgb(0 0 0 / .4);object-fit:cover;background:var(--background)}
`;

// Avatars data-URI (initiales de structures du réseau) — aucun réseau.
const avatar = (bg: string, initiales: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72'><rect width='72' height='72' fill='${bg}'/><text x='36' y='37' font-family='sans-serif' font-size='26' font-weight='700' fill='#ffffff' text-anchor='middle' dominant-baseline='central'>${initiales}</text></svg>`
  );

const mapBg =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='320'><rect width='640' height='320' fill='#edefe8'/><rect x='30' y='24' width='110' height='44' fill='#e0e4d8'/><rect x='210' y='110' width='90' height='58' fill='#e0e4d8'/><rect x='470' y='40' width='120' height='50' fill='#e0e4d8'/><rect x='60' y='210' width='80' height='60' fill='#e0e4d8'/><path d='M0 90 H640' stroke='#ffffff' stroke-width='14'/><path d='M0 195 H640' stroke='#ffffff' stroke-width='10'/><path d='M170 0 V320' stroke='#ffffff' stroke-width='12'/><path d='M430 0 V320' stroke='#ffffff' stroke-width='8'/><path d='M0 275 Q220 245 360 295 T640 265' stroke='#bfd8e8' stroke-width='16' fill='none'/></svg>`
  );

const carte: CSSProperties = {
  position: "relative",
  height: 220,
  borderRadius: "var(--radius)",
  overflow: "hidden",
  backgroundImage: `url("${mapBg}")`,
  backgroundSize: "cover",
  border: "1px solid var(--border)",
};

const pose = (left: number, top: number): CSSProperties => ({
  position: "absolute",
  left,
  top,
  transform: "translate(-50%, -50%)",
});

// Vignettes des structures posées sur le plan.
export const SurCarte = () => (
  <div style={carte}>
    <style>{markerCss}</style>
    <span style={pose(120, 85)}><MapMarkerAvatar src={avatar("#6366f1", "MF")} /></span>
    <span style={pose(260, 155)}><MapMarkerAvatar src={avatar("#10b981", "TP")} /></span>
    <span style={pose(400, 75)}><MapMarkerAvatar src={avatar("#f59e0b", "GE")} /></span>
    <span style={pose(510, 195)}><MapMarkerAvatar src={avatar("#ec4899", "KN")} /></span>
  </div>
);

// Mode split liste→carte : la vignette focalisée est agrandie + halo --primary.
export const VignetteFocalisee = () => (
  <div style={carte}>
    <style>{markerCss}</style>
    <button type="button" className="search-map-marker-btn" style={pose(180, 150)}>
      <MapMarkerAvatar src={avatar("#10b981", "TP")} />
    </button>
    <button type="button" className="search-map-marker-btn is-focused" style={pose(330, 110)}>
      <MapMarkerAvatar src={avatar("#6366f1", "MF")} />
    </button>
    <button type="button" className="search-map-marker-btn" style={pose(470, 190)}>
      <MapMarkerAvatar src={avatar("#f59e0b", "GE")} />
    </button>
  </div>
);
