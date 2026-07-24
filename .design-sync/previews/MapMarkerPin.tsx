import type { CSSProperties } from "react";
import { MapMarkerPin } from "site-forge";

// Marqueur « goutte » SVG de la carte de recherche (style par défaut) —
// composant React (pas une chaîne HTML Leaflet) : fill = couleur de thème,
// contour + pastille = borderCssColor (déf. var(--background)).
// NB : ses classes compagnes vivent dans src/modules/search/styles.css
// (chunk lazy absent du CSS du bundle DS) → on les réinjecte à l'identique.
const markerCss = `
.search-map-marker-btn{padding:0;border:0;background:none;line-height:0;cursor:pointer}
.search-map-marker-btn.is-focused{position:relative;z-index:10}
.search-map-marker-btn.is-focused>*{transform:scale(1.4);filter:drop-shadow(0 0 2px var(--primary)) drop-shadow(0 0 5px var(--primary))}
.search-map-pin{display:block;filter:drop-shadow(0 1px 2px rgb(0 0 0 / .45))}
`;

// Fond façon plan de ville (data-URI, aucun réseau).
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
  transform: "translate(-50%, -100%)", // ancre : pointe de la goutte
});

// Pins aux couleurs du thème posés sur le plan.
export const SurCarte = () => (
  <div style={carte}>
    <style>{markerCss}</style>
    <span style={pose(120, 95)}><MapMarkerPin cssColor="var(--primary)" /></span>
    <span style={pose(265, 160)}><MapMarkerPin cssColor="var(--chart-2)" /></span>
    <span style={pose(400, 80)}><MapMarkerPin cssColor="var(--chart-4)" /></span>
    <span style={pose(520, 190)}><MapMarkerPin cssColor="var(--chart-5)" /></span>
  </div>
);

// Mode split liste→carte : le résultat survolé dans la liste est agrandi
// avec un halo --primary (classe .is-focused du bouton-conteneur réel).
export const MarqueurFocalise = () => (
  <div style={carte}>
    <style>{markerCss}</style>
    <button type="button" className="search-map-marker-btn" style={pose(180, 150)}>
      <MapMarkerPin cssColor="var(--chart-2)" />
    </button>
    <button type="button" className="search-map-marker-btn is-focused" style={pose(330, 120)}>
      <MapMarkerPin cssColor="var(--primary)" />
    </button>
    <button type="button" className="search-map-marker-btn" style={pose(470, 180)}>
      <MapMarkerPin cssColor="var(--chart-4)" />
    </button>
  </div>
);

// Contour personnalisé (borderCssColor) — par défaut var(--background).
export const ContourPersonnalise = () => (
  <div style={{ display: "flex", gap: 24, alignItems: "flex-end", padding: 16, background: "var(--muted)", borderRadius: "var(--radius)" }}>
    <style>{markerCss}</style>
    <MapMarkerPin cssColor="var(--primary)" />
    <MapMarkerPin cssColor="var(--chart-3)" borderCssColor="var(--primary-foreground)" />
    <MapMarkerPin cssColor="var(--chart-1)" borderCssColor="var(--accent)" />
  </div>
);
