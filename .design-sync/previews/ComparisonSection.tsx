import { ComparisonSection } from "site-forge";

// Avant/après : réhabilitation d'une friche en tiers-lieu. Les libellés sont
// aussi « cuits » dans les SVG car au curseur 50 % l'image « après » recouvre
// la moitié gauche (le calque après est au-dessus du calque avant).
const svg = (parts: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">${parts}</svg>`,
  );

// Friche (avant) : tons gris, bâtiment sombre — texte côté droit (moitié visible).
const friche = svg(
  '<rect width="800" height="450" fill="#94a3b8"/>' +
    '<rect y="300" width="800" height="150" fill="#64748b"/>' +
    '<rect x="480" y="140" width="240" height="180" fill="#475569"/>' +
    '<rect x="510" y="170" width="50" height="60" fill="#334155"/>' +
    '<rect x="590" y="170" width="50" height="60" fill="#334155"/>' +
    '<rect x="120" y="200" width="180" height="120" fill="#52525b"/>' +
    '<text x="600" y="70" font-family="sans-serif" font-size="34" font-weight="bold" fill="#1e293b" text-anchor="middle">Avant — 2018</text>',
);

// Tiers-lieu réhabilité (après) : tons verts, soleil — texte côté gauche (moitié visible).
const rehabilite = svg(
  '<rect width="800" height="450" fill="#a7f3d0"/>' +
    '<rect y="300" width="800" height="150" fill="#34d399"/>' +
    '<circle cx="660" cy="90" r="46" fill="#fbbf24"/>' +
    '<rect x="480" y="150" width="240" height="170" fill="#0f766e"/>' +
    '<rect x="510" y="180" width="50" height="60" fill="#f0fdf4"/>' +
    '<rect x="590" y="180" width="50" height="60" fill="#f0fdf4"/>' +
    '<circle cx="180" cy="260" r="60" fill="#059669"/>' +
    '<rect x="170" y="300" width="20" height="60" fill="#78350f"/>' +
    '<text x="200" y="70" font-family="sans-serif" font-size="34" font-weight="bold" fill="#064e3b" text-anchor="middle">Après — 2024</text>',
);

export const AvantApres = () => (
  <ComparisonSection
    props={{
      beforeImage: friche,
      afterImage: rehabilite,
      beforeLabel: { fr: "Avant" },
      afterLabel: { fr: "Après" },
      orientation: "horizontal",
    }}
  />
);

// Variante verticale : le calque après occupe la moitié basse.
const hiver = svg(
  '<rect width="800" height="450" fill="#cbd5e1"/>' +
    '<rect y="330" width="800" height="120" fill="#e2e8f0"/>' +
    '<circle cx="200" cy="250" r="55" fill="#94a3b8"/>' +
    '<rect x="190" y="290" width="20" height="70" fill="#57534e"/>' +
    '<text x="400" y="70" font-family="sans-serif" font-size="34" font-weight="bold" fill="#334155" text-anchor="middle">Jardin partagé — hiver</text>',
);

const ete = svg(
  '<rect width="800" height="450" fill="#bbf7d0"/>' +
    '<rect y="330" width="800" height="120" fill="#4ade80"/>' +
    '<circle cx="200" cy="250" r="55" fill="#16a34a"/>' +
    '<rect x="190" y="290" width="20" height="70" fill="#78350f"/>' +
    '<circle cx="640" cy="120" r="40" fill="#facc15"/>' +
    '<text x="400" y="410" font-family="sans-serif" font-size="34" font-weight="bold" fill="#14532d" text-anchor="middle">Jardin partagé — été</text>',
);

export const CurseurVertical = () => (
  <ComparisonSection
    props={{
      beforeImage: hiver,
      afterImage: ete,
      beforeLabel: { fr: "Hiver" },
      afterLabel: { fr: "Été" },
      orientation: "vertical",
    }}
  />
);
