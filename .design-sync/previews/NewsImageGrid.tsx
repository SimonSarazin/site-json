import type { CSSProperties } from "react";
import { NewsImageGrid } from "site-forge";

// Grille photo d une actu (1→6 vignettes + compteur « +N » au-delà). Le
// composant embarque son padding (px-6 pb-4) ; images en data-URI SVG plates.

const photo = (bg: string, accent: string, label: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">` +
      `<rect width="600" height="400" fill="${bg}"/>` +
      `<circle cx="480" cy="90" r="44" fill="${accent}"/>` +
      `<path d="M0 400 L170 220 L320 360 L440 260 L600 400 Z" fill="${accent}"/>` +
      `<text x="30" y="70" font-family="sans-serif" font-size="30" font-weight="bold" fill="#ffffff">${label}</text>` +
    `</svg>`
  );

const atelier = [
  photo("#334e7d", "#f4c95d", "Atelier portage"),
  photo("#2e7d64", "#f0e9dd", "Espace motricite"),
  photo("#7c4d8f", "#f4c95d", "Cafe des parents"),
  photo("#b45f3c", "#f0e9dd", "Ludotheque"),
  photo("#3c6e8f", "#f4c95d", "Lecture partagee"),
  photo("#8f3c5f", "#f0e9dd", "Jeux geants"),
  photo("#4d7c3c", "#f4c95d", "Gouter"),
  photo("#5f5f8f", "#f0e9dd", "Cloture"),
];

const items = (n: number) =>
  atelier.slice(0, n).map((src, i) => ({
    id: `img-${i + 1}`,
    name: `Photo ${i + 1} de la journée des familles`,
    imagePath: src,
    imageThumbPath: src,
  }));

const conteneur: CSSProperties = { maxWidth: 620, margin: "0 auto" };

export const UneImage = () => (
  <div style={conteneur}>
    <NewsImageGrid images={items(1)} />
  </div>
);

export const TroisImages = () => (
  <div style={conteneur}>
    <NewsImageGrid images={items(3)} />
  </div>
);

export const QuatreImages = () => (
  <div style={conteneur}>
    <NewsImageGrid images={items(4)} />
  </div>
);

export const HuitImages = () => (
  <div style={conteneur}>
    <NewsImageGrid images={items(8)} />
  </div>
);
