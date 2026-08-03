import { ArticleCard } from "site-forge";

// Carte éditoriale du module blog : props = objet ArticleData (POI type=article)
// + href. Dates FIXES (unix s), images en data-URI SVG (formes plates + hex).

const cover = (bg: string, accent: string, label: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450">` +
      `<rect width="800" height="450" fill="${bg}"/>` +
      `<circle cx="640" cy="110" r="56" fill="${accent}"/>` +
      `<rect x="60" y="300" width="300" height="16" rx="8" fill="${accent}"/>` +
      `<rect x="60" y="330" width="200" height="16" rx="8" fill="${accent}"/>` +
      `<text x="60" y="120" font-family="sans-serif" font-size="40" font-weight="bold" fill="#ffffff">${label}</text>` +
    `</svg>`
  );

const corps = [
  "Entre 0 et 3 ans, le sommeil se construit par cycles courts qui se rallongent avec la maturation du cerveau.",
  "Les reveils nocturnes sont donc normaux : ce qui change tout, c est la maniere dont l enfant apprend a se rendormir seul.",
  "",
  "## Des rituels previsibles",
  "",
  "Un coucher qui se ressemble chaque soir (bain, histoire, chanson) envoie un signal clair au corps de l enfant.",
  "Les professionnelles du reseau conseillent de garder le meme ordre et la meme duree, meme en vacances.",
  "",
  "- Une chambre entre 18 et 20 degres",
  "- Un objet transitionnel choisi par l enfant",
  "- Des ecrans eteints au moins une heure avant le coucher",
  "",
  "> Le sommeil ne se force pas, il s accueille : notre role de parent est de creer les conditions, pas de le declencher.",
  "",
  "Si les difficultes persistent au-dela de quelques semaines, les consultations sommeil des PMI du departement peuvent prendre le relais.",
].join("\n");

const articleSommeil = {
  id: "poi-sommeil",
  name: "Le sommeil du jeune enfant : comprendre les cycles pour apaiser les nuits",
  slug: "sommeil-jeune-enfant",
  shortDescription:
    "Réveils nocturnes, endormissement difficile… Les repères des professionnelles du réseau pour accompagner le sommeil de 0 à 3 ans.",
  description: corps,
  created: 1749686400, // 12 juin 2025
  tags: ["Sommeil", "0-3 ans", "Conseils"],
  profilImageUrl: cover("#334e7d", "#f4c95d", "Nuits paisibles"),
  profilMediumImageUrl: cover("#334e7d", "#f4c95d", "Nuits paisibles"),
  parent: { org1: { type: "organizations", name: "Réseau Parentalité 62" } },
};

const articleMotricite = {
  id: "poi-motricite",
  name: "La motricité libre à la maison : par où commencer ?",
  slug: "motricite-libre",
  shortDescription:
    "Tapis au sol, vêtements souples, regard bienveillant : trois gestes simples pour laisser bébé explorer ses mouvements à son rythme.",
  description: corps,
  created: 1746662400, // 8 mai 2025
  tags: ["Motricité", "Éveil"],
  profilImageUrl: cover("#2e7d64", "#f0e9dd", "Motricite libre"),
  profilMediumImageUrl: cover("#2e7d64", "#f0e9dd", "Motricite libre"),
  parent: { org1: { type: "organizations", name: "Réseau Parentalité 62" } },
};

const articleSansImage = {
  id: "poi-cafe",
  name: "Café des parents : le programme du printemps est en ligne",
  slug: "cafe-parents-printemps",
  shortDescription:
    "Six rencontres gratuites entre mars et juin, animées par les accueillantes des lieux d'accueil enfants-parents du département.",
  description: "Le programme complet est disponible dans les structures partenaires et sur cette page.",
  created: 1743465600, // 1 avril 2025
  tags: ["Rencontres"],
  parent: { org1: { type: "organizations", name: "Réseau Parentalité 62" } },
};

export const Grille = () => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 20, maxWidth: 760, margin: "0 auto" }}>
    <ArticleCard article={articleSommeil} href="/blog/sommeil-jeune-enfant" />
    <ArticleCard article={articleMotricite} href="/blog/motricite-libre" />
  </div>
);

export const EnVedette = () => (
  <div style={{ maxWidth: 680, margin: "0 auto" }}>
    <ArticleCard article={articleSommeil} href="/blog/sommeil-jeune-enfant" featured />
  </div>
);

export const SansImage = () => (
  <div style={{ maxWidth: 400, margin: "0 auto" }}>
    <ArticleCard article={articleSansImage} href="/blog/cafe-parents-printemps" />
  </div>
);
