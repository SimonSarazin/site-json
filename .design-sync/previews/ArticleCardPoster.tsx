import { ArticleCardPoster } from "site-forge";

// Variant « poster » : l affiche est montrée EN ENTIER (object-contain) sur un
// fond flou de la même image — cadre 3/4 en grille, écran scindé en vedette.
// Affiches A4 / carrées en data-URI SVG (pas d apostrophes dans le SVG).

const afficheA4 = (bg: string, accent: string, l1: string, l2: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842">` +
      `<rect width="595" height="842" fill="${bg}"/>` +
      `<rect x="40" y="40" width="515" height="762" fill="none" stroke="${accent}" stroke-width="4"/>` +
      `<circle cx="298" cy="250" r="90" fill="${accent}"/>` +
      `<text x="298" y="430" font-family="sans-serif" font-size="52" font-weight="bold" fill="#ffffff" text-anchor="middle">${l1}</text>` +
      `<text x="298" y="500" font-family="sans-serif" font-size="52" font-weight="bold" fill="#ffffff" text-anchor="middle">${l2}</text>` +
      `<text x="298" y="600" font-family="sans-serif" font-size="30" fill="#ffffff" text-anchor="middle">Samedi 14 juin - 10h a 12h</text>` +
      `<text x="298" y="650" font-family="sans-serif" font-size="30" fill="#ffffff" text-anchor="middle">Maison des familles - Arras</text>` +
      `<rect x="180" y="710" width="236" height="52" rx="26" fill="${accent}"/>` +
      `<text x="298" y="745" font-family="sans-serif" font-size="26" fill="#1f2937" text-anchor="middle">Entree libre</text>` +
    `</svg>`
  );

const afficheCarree = (bg: string, accent: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="700">` +
      `<rect width="700" height="700" fill="${bg}"/>` +
      `<circle cx="560" cy="140" r="70" fill="${accent}"/>` +
      `<text x="60" y="330" font-family="sans-serif" font-size="64" font-weight="bold" fill="#ffffff">Fete du jeu</text>` +
      `<text x="60" y="410" font-family="sans-serif" font-size="34" fill="#ffffff">Dimanche 22 juin - parc des Iles</text>` +
      `<rect x="60" y="480" width="220" height="52" rx="26" fill="${accent}"/>` +
      `<text x="170" y="515" font-family="sans-serif" font-size="26" fill="#1f2937" text-anchor="middle">Gratuit</text>` +
    `</svg>`
  );

const base = {
  parent: { org1: { type: "organizations", name: "Réseau Parentalité 62" } },
};

const atelierSommeil = {
  ...base,
  id: "poi-atelier-sommeil",
  name: "Atelier sommeil : accompagner les nuits des tout-petits",
  shortDescription:
    "Un temps d'échange animé par une puéricultrice du réseau : cycles du sommeil, rituels du coucher, réveils nocturnes. Sur inscription.",
  description:
    "Programme complet de la matinée : accueil café, apports théoriques, questions des familles et remise du livret sommeil.",
  created: 1749686400, // 12 juin 2025
  tags: ["Atelier", "Sommeil", "0-3 ans"],
  profilMediumImageUrl: afficheA4("#334e7d", "#f4c95d", "ATELIER", "SOMMEIL"),
  profilImageUrl: afficheA4("#334e7d", "#f4c95d", "ATELIER", "SOMMEIL"),
};

const feteDuJeu = {
  ...base,
  id: "poi-fete-jeu",
  name: "Fête du jeu : une journée pour jouer en famille",
  shortDescription:
    "Jeux géants, espace motricité, ludothèque éphémère : la fête annuelle du réseau revient au parc des Îles.",
  description: "Toutes les animations sont gratuites et ouvertes aux enfants de 0 à 12 ans accompagnés.",
  created: 1746662400, // 8 mai 2025
  tags: ["Événement", "Familles"],
  profilMediumImageUrl: afficheCarree("#7c4d8f", "#f4c95d"),
  profilImageUrl: afficheCarree("#7c4d8f", "#f4c95d"),
};

const sansAffiche = {
  ...base,
  id: "poi-sans-affiche",
  name: "Permanences d'écoute parentale : nouveaux horaires",
  shortDescription: "Les permanences du mardi passent de 14h à 18h dès la rentrée, sans rendez-vous.",
  created: 1743465600, // 1 avril 2025
  tags: ["Pratique"],
};

export const Grille = () => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 20, maxWidth: 680, margin: "0 auto" }}>
    <ArticleCardPoster article={atelierSommeil} href="/blog/atelier-sommeil" />
    <ArticleCardPoster article={feteDuJeu} href="/blog/fete-du-jeu" />
  </div>
);

export const EnVedette = () => (
  <div style={{ maxWidth: 860, margin: "0 auto" }}>
    <ArticleCardPoster article={atelierSommeil} href="/blog/atelier-sommeil" featured />
  </div>
);

export const SansImage = () => (
  <div style={{ maxWidth: 340, margin: "0 auto" }}>
    <ArticleCardPoster article={sansAffiche} href="/blog/permanences-ecoute" />
  </div>
);
