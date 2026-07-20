import { ProductShowcaseSection } from "site-forge";

// Boutique solidaire d'un tiers-lieu — images en data-URI SVG (pas d'URL http).
const photo = (bg: string, accent: string, label: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">` +
      `<rect width="600" height="400" fill="${bg}"/>` +
      `<circle cx="470" cy="110" r="70" fill="${accent}" opacity="0.55"/>` +
      `<rect x="60" y="230" width="220" height="130" rx="14" fill="${accent}"/>` +
      `<text x="300" y="120" font-family="sans-serif" font-size="30" font-weight="bold" fill="#1e293b" text-anchor="middle">${label}</text>` +
      `</svg>`,
  );

const mug1 = photo("#fde68a", "#f59e0b", "Mug sérigraphié");
const mug2 = photo("#fcd34d", "#d97706", "Mug — vue arrière");
const toteBag = photo("#bfdbfe", "#3b82f6", "Tote bag en coton bio");
const miel = photo("#bbf7d0", "#22c55e", "Miel du rucher partagé");

export const GrilleBoutique = () => (
  <ProductShowcaseSection
    props={{
      layout: "grid",
      showPrices: true,
      products: [
        {
          id: "mug",
          name: { fr: "Mug sérigraphié" },
          description: { fr: "Mug en céramique sérigraphié à la main dans l'atelier du tiers-lieu, série limitée." },
          price: "12 €",
          images: [mug1, mug2],
          features: [{ fr: "Céramique locale" }, { fr: "Sérigraphie artisanale" }, { fr: "Passe au lave-vaisselle" }],
          cta: { label: { fr: "Ajouter au panier" }, href: "/boutique/mug" },
        },
        {
          id: "tote",
          name: { fr: "Tote bag" },
          description: { fr: "Sac en coton bio imprimé par l'atelier d'insertion, idéal pour le marché." },
          price: "8 €",
          images: [toteBag],
          features: [{ fr: "Coton biologique certifié" }, { fr: "Impression végétale" }],
          cta: { label: { fr: "Ajouter au panier" }, href: "/boutique/tote-bag" },
        },
        {
          id: "miel",
          name: { fr: "Miel du rucher" },
          description: { fr: "Miel toutes fleurs récolté sur les toits du quartier par le collectif apicole." },
          price: "7,50 €",
          images: [miel],
          features: [{ fr: "Pot de 250 g" }, { fr: "Récolte 2025" }, { fr: "Circuit ultra-court" }],
          cta: { label: { fr: "Ajouter au panier" }, href: "/boutique/miel" },
        },
      ],
    }}
  />
);

// Mise en avant : le premier produit occupe 2 colonnes / 2 rangées.
export const MiseEnAvant = () => (
  <ProductShowcaseSection
    props={{
      layout: "featured",
      showPrices: true,
      products: [
        {
          id: "panier",
          name: { fr: "Panier de saison" },
          description: { fr: "Légumes de la ferme urbaine partenaire, composés chaque semaine selon la récolte. Abonnement sans engagement, retrait au tiers-lieu le jeudi." },
          price: "18 €",
          images: [photo("#bbf7d0", "#16a34a", "Panier de saison")],
          features: [
            { fr: "100 % local, à moins de 20 km" },
            { fr: "Agriculture biologique" },
            { fr: "Retrait le jeudi 16h-19h" },
            { fr: "Recettes incluses" },
          ],
          cta: { label: { fr: "S'abonner" }, href: "/boutique/panier" },
        },
        {
          id: "mug-f",
          name: { fr: "Mug sérigraphié" },
          description: { fr: "Série limitée de l'atelier sérigraphie." },
          price: "12 €",
          images: [mug1],
          cta: { label: { fr: "Ajouter" }, href: "/boutique/mug" },
        },
        {
          id: "tote-f",
          name: { fr: "Tote bag" },
          description: { fr: "Coton bio imprimé sur place." },
          price: "8 €",
          images: [toteBag],
          cta: { label: { fr: "Ajouter" }, href: "/boutique/tote-bag" },
        },
      ],
    }}
  />
);
