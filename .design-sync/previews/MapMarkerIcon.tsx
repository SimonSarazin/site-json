import type { CSSProperties } from "react";
import { MapMarkerIcon } from "site-forge";

// Marqueur « icône custom » (map.marker.iconUrl) — composant React (pas une
// chaîne HTML Leaflet) : <img> brandée par site/section, taille en px via la
// prop size (← iconSize de la config). Style compagnon de
// src/modules/search/styles.css (chunk lazy absent du CSS du bundle DS)
// → réinjecté à l'identique.
const markerCss = `
.search-map-marker-btn{padding:0;border:0;background:none;line-height:0;cursor:pointer}
.search-map-marker-btn.is-focused{position:relative;z-index:10}
.search-map-marker-btn.is-focused>*{transform:scale(1.4);filter:drop-shadow(0 0 2px var(--primary)) drop-shadow(0 0 5px var(--primary))}
.search-map-icon{display:block;object-fit:contain;filter:drop-shadow(0 1px 2px rgb(0 0 0 / .45))}
`;

// Icône brandée (data-URI) : goutte avec pictogramme maison — aucun réseau.
const iconeMaison = (fill: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='48' height='48'><path d='M12 1C7.6 1 4 4.6 4 9c0 5.8 8 14 8 14s8-8.2 8-14c0-4.4-3.6-8-8-8Z' fill='${fill}' stroke='#ffffff' stroke-width='1.2'/><path d='M12 5.2 8.2 8.4v4.4h2.6v-2.6h2.4v2.6h2.6V8.4Z' fill='#ffffff'/></svg>`
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
  transform: "translate(-50%, -100%)",
});

// Icônes brandées posées sur le plan (size 36).
export const SurCarte = () => (
  <div style={carte}>
    <style>{markerCss}</style>
    <span style={pose(130, 95)}><MapMarkerIcon src={iconeMaison("#0d9488")} size={36} /></span>
    <span style={pose(280, 165)}><MapMarkerIcon src={iconeMaison("#0d9488")} size={36} /></span>
    <span style={pose(420, 85)}><MapMarkerIcon src={iconeMaison("#0d9488")} size={36} /></span>
    <span style={pose(530, 200)}><MapMarkerIcon src={iconeMaison("#0d9488")} size={36} /></span>
  </div>
);

// La prop size pilote la taille rendue (iconSize de la config carte).
export const TaillesConfigurables = () => (
  <div style={{ display: "flex", gap: 24, alignItems: "flex-end", padding: 16, background: "var(--muted)", borderRadius: "var(--radius)" }}>
    <style>{markerCss}</style>
    <MapMarkerIcon src={iconeMaison("#7c3aed")} size={24} />
    <MapMarkerIcon src={iconeMaison("#7c3aed")} size={36} />
    <MapMarkerIcon src={iconeMaison("#7c3aed")} size={48} />
  </div>
);
