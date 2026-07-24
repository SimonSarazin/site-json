import { BlogPostSection } from "site-forge";

// Article seul (type "blogPost") : contenu HTML rendu en prose.
// L'image à la une (h-96) remplit une cellule à elle seule → un export dédié
// pour l'en-tête visuel, et un export SANS image pour montrer méta + auteur +
// tags + prose dans le cadre. Images : data-URI SVG uniquement.

const cover =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#3b6ea5"/><text x="400" y="210" font-family="sans-serif" font-size="30" fill="#ffffff" text-anchor="middle">Sommeil du jeune enfant</text></svg>`
  );

const avatarCM =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#2e8b6e"/><text x="48" y="58" font-family="sans-serif" font-size="30" fill="#ffffff" text-anchor="middle">CM</text></svg>`
  );

const contenu = {
  fr: `
    <p>Entre 0 et 3 ans, le sommeil de l'enfant se construit par étapes. Les réveils nocturnes,
    loin d'être un « problème », font partie d'une maturation normale que chaque famille traverse
    à son rythme.</p>
    <h2>Des rythmes propres à chaque enfant</h2>
    <p>Les professionnels des lieux d'accueil enfants-parents le rappellent : il n'existe pas de
    norme unique. Certains bébés font leurs nuits à trois mois, d'autres à deux ans — les deux
    situations sont ordinaires.</p>
    <blockquote>« Le plus utile pour les parents, c'est de comprendre ce qui se joue, pas
    d'appliquer une recette. »</blockquote>
    <h2>Quelques repères partagés en atelier</h2>
    <ul>
      <li>Un rituel du coucher court et régulier rassure l'enfant.</li>
      <li>La pénombre et le calme aident à distinguer le jour de la nuit.</li>
      <li>En cas d'épuisement parental, en parler est déjà une solution : les cafés des parents
      sont là pour ça.</li>
    </ul>
    <p>Le prochain atelier « sommeil » se tiendra au centre social d'Arras — inscription libre
    et gratuite.</p>
  `,
};

const articleBase = {
  title: { fr: "Le sommeil du jeune enfant, sans pression" },
  excerpt: { fr: "Comprendre les rythmes de 0 à 3 ans et desserrer la culpabilité : la synthèse de notre cycle d'ateliers avec une puéricultrice de PMI." },
  content: contenu,
  author: {
    name: { fr: "Claire Mercier" },
    avatar: avatarCM,
    bio: { fr: "Puéricultrice de PMI, animatrice des ateliers sommeil du réseau" },
  },
  publishedAt: "2026-06-02",
  tags: [{ fr: "Sommeil" }, { fr: "0-3 ans" }, { fr: "Ateliers" }],
  readTime: 7,
};

// En-tête d'article avec image à la une (le haut de page réel).
export const EnTeteAvecImage = () => (
  <BlogPostSection props={{ ...articleBase, featuredImage: cover }} />
);

// Même article sans image : méta, encart auteur, tags et prose visibles.
export const ArticleComplet = () => <BlogPostSection props={articleBase} />;

export const ArticleSobre = () => (
  <BlogPostSection
    props={{
      title: { fr: "Compte rendu : rencontre départementale des acteurs de la parentalité" },
      content: {
        fr: `<p>La rencontre annuelle du réseau s'est tenue à Lens le 22 mai. Quarante structures
        étaient représentées : centres sociaux, CAF, Éducation Nationale et associations de
        parents.</p><p>Trois chantiers ont été retenus pour 2026-2027 : l'accès aux familles les
        plus éloignées, la formation des bénévoles et la mutualisation des outils d'animation.</p>`,
      },
      publishedAt: "2026-05-25",
    }}
  />
);
