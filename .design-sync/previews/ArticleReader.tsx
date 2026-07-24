import { ArticleReader } from "site-forge";

// Lecteur d article : retour + titre + méta (date, auteur = parent, temps de
// lecture) + chapo + hero 16/9 + corps markdown sanitizé + tags. Date FIXE.
// La cellule de capture plafonne à ~700px → anatomie répartie sur 2 stories :
// « Article » (chapo + corps markdown + tags) et « AvecCouverture » (hero 16/9).

const cover =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="506">` +
      `<rect width="900" height="506" fill="#334e7d"/>` +
      `<circle cx="720" cy="120" r="64" fill="#f4c95d"/>` +
      `<circle cx="700" cy="110" r="56" fill="#334e7d"/>` +
      `<circle cx="200" cy="400" r="10" fill="#f0e9dd"/>` +
      `<circle cx="320" cy="330" r="6" fill="#f0e9dd"/>` +
      `<circle cx="480" cy="410" r="8" fill="#f0e9dd"/>` +
      `<text x="60" y="150" font-family="sans-serif" font-size="46" font-weight="bold" fill="#ffffff">Nuits paisibles</text>` +
    `</svg>`
  );

const corps = [
  "Entre la naissance et 3 ans, le sommeil se construit par **cycles courts** qui se rallongent avec la maturation du cerveau. Les réveils nocturnes sont donc normaux : ce qui change tout, c'est la manière dont l'enfant apprend à se rendormir.",
  "",
  "> Le sommeil ne se force pas, il s'accueille : notre rôle de parent est de créer les conditions, pas de le déclencher.",
  "",
  "Un coucher qui se ressemble chaque soir — bain, histoire, chanson — envoie un signal clair au corps de l'enfant. Si les difficultés persistent au-delà de quelques semaines, les [consultations sommeil](https://exemple.fr/consultations) des PMI du département prennent le relais.",
].join("\n");

const article = {
  id: "poi-sommeil",
  name: "Le sommeil du jeune enfant : des nuits plus paisibles",
  slug: "sommeil-jeune-enfant",
  shortDescription:
    "Réveils nocturnes, endormissement difficile… Les repères des professionnelles du réseau pour accompagner le sommeil de 0 à 3 ans.",
  description: corps,
  created: 1749686400, // 12 juin 2025
  tags: ["Sommeil", "0-3 ans", "Conseils", "PMI"],
  parent: { org1: { type: "organizations", name: "Réseau Parentalité 62" } },
};

const articleAvecCouverture = {
  id: "poi-cafe",
  name: "Café des parents : le programme du printemps est en ligne",
  description:
    "Six rencontres gratuites entre mars et juin, animées par les accueillantes des lieux d'accueil enfants-parents du département.",
  created: 1743465600, // 1 avril 2025
  tags: ["Rencontres", "Familles"],
  profilImageUrl: cover,
  parent: { org1: { type: "organizations", name: "Réseau Parentalité 62" } },
};

export const Article = () => (
  <div style={{ maxWidth: 700, margin: "0 auto" }}>
    <ArticleReader article={article} />
  </div>
);

export const AvecCouverture = () => (
  <div style={{ maxWidth: 620, margin: "0 auto" }}>
    <ArticleReader article={articleAvecCouverture} hideBack />
  </div>
);
