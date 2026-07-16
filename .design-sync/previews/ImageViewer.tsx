import { ImageViewer } from "site-forge";

// Lightbox plein écran (Radix Dialog en portal, fixed 98vw/92vh) : une seule
// story — plusieurs exports empileraient des dialogues. Images en data-URI SVG
// avec width/height explicites (naturalWidth requis par le calcul « fit »).

// Tons moyens/foncés : les contrôles du viewer (chevrons, zoom) sont en
// blanc/70 par-dessus l'image — illisibles sur un placeholder pastel.
const photo = (fond: string, forme: string, accent: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">` +
      `<rect width="800" height="500" fill="${fond}"/>` +
      `<circle cx="640" cy="110" r="60" fill="${accent}"/>` +
      `<path d="M0 500 L220 260 L400 430 L560 300 L800 500 Z" fill="${forme}"/>` +
      `<path d="M0 500 L160 360 L320 500 Z" fill="${accent}"/>` +
    `</svg>`
  );

const images = [
  { src: photo("#1e3a5f", "#0f2440", "#3b82f6"), name: "Atelier jardinage partagé — mai 2026" },
  { src: photo("#14532d", "#052e16", "#16a34a"), name: "Sortie familles au lac de Villeneuve" },
  { src: photo("#7c2d12", "#431407", "#ea580c"), name: "Fête du réseau — clôture de saison" },
];

export const Visionneuse = () => (
  <ImageViewer images={images} initialIndex={0} open onClose={() => {}} />
);
