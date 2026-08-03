import { ArticleCardCompact } from "site-forge";

// Variant compact (feedLayout "list") : ligne horizontale vignette carrée +
// date + titre + extrait 2 lignes. Dates FIXES, vignettes en data-URI SVG.

const vignette = (bg: string, accent: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">` +
      `<rect width="240" height="240" fill="${bg}"/>` +
      `<circle cx="170" cy="70" r="34" fill="${accent}"/>` +
      `<rect x="30" y="150" width="130" height="14" rx="7" fill="${accent}"/>` +
      `<rect x="30" y="178" width="90" height="14" rx="7" fill="${accent}"/>` +
    `</svg>`
  );

const base = {
  description: "Corps de l article au format markdown, remplacé ici par l extrait court.",
  parent: { org1: { type: "organizations", name: "Réseau Parentalité 62" } },
};

const items = [
  {
    ...base,
    id: "poi-sommeil",
    name: "Le sommeil du jeune enfant : comprendre les cycles pour apaiser les nuits",
    shortDescription:
      "Réveils nocturnes, endormissement difficile… Les repères des professionnelles du réseau pour accompagner le sommeil de 0 à 3 ans.",
    created: 1749686400, // 12 juin 2025
    profilMediumImageUrl: vignette("#334e7d", "#f4c95d"),
  },
  {
    ...base,
    id: "poi-motricite",
    name: "La motricité libre à la maison : par où commencer ?",
    shortDescription:
      "Tapis au sol, vêtements souples, regard bienveillant : trois gestes simples pour laisser bébé explorer à son rythme.",
    created: 1746662400, // 8 mai 2025
    profilMediumImageUrl: vignette("#2e7d64", "#f0e9dd"),
  },
  {
    ...base,
    id: "poi-cafe",
    name: "Café des parents : le programme du printemps est en ligne",
    shortDescription:
      "Six rencontres gratuites entre mars et juin, animées par les accueillantes des lieux d'accueil enfants-parents.",
    created: 1743465600, // 1 avril 2025
    // sans image → placeholder « — »
  },
];

export const Liste = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640, margin: "0 auto" }}>
    {items.map((a) => (
      <ArticleCardCompact key={a.id} article={a} href={`/blog/${a.id}`} />
    ))}
  </div>
);

export const EnVedette = () => (
  <div style={{ maxWidth: 640, margin: "0 auto" }}>
    <ArticleCardCompact article={items[0]} href="/blog/sommeil-jeune-enfant" featured />
  </div>
);
