import { BlogListSection } from "site-forge";

// Usage réel : page /blog de config.prod.json (grille 3 colonnes, pagination).
// Images : data-URI SVG uniquement (OptimizedImage laisse passer data:).

const cover = (label: string, bg: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="${bg}"/><text x="300" y="158" font-family="sans-serif" font-size="26" fill="#ffffff" text-anchor="middle">${label}</text></svg>`
  );

const avatar = (initials: string, bg: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="${bg}"/><text x="40" y="48" font-family="sans-serif" font-size="26" fill="#ffffff" text-anchor="middle">${initials}</text></svg>`
  );

const posts = [
  {
    id: "1",
    title: { fr: "La motricité libre expliquée aux parents" },
    excerpt: { fr: "Laisser bébé explorer ses mouvements à son rythme : pourquoi cette approche fait consensus et comment l'appliquer à la maison." },
    slug: "motricite-libre",
    publishedAt: "2026-05-12",
    author: { name: { fr: "Claire Mercier" }, avatar: avatar("CM", "#3b6ea5") },
    featuredImage: cover("Motricité libre", "#3b6ea5"),
    tags: [{ fr: "Petite enfance" }, { fr: "Développement" }],
    readTime: 6,
  },
  {
    id: "2",
    title: { fr: "Écrans et tout-petits : trouver l'équilibre" },
    excerpt: { fr: "Les repères 3-6-9-12 revisités par les professionnels du réseau, avec des idées concrètes d'activités sans écran." },
    slug: "ecrans-tout-petits",
    publishedAt: "2026-04-28",
    author: { name: { fr: "Karim Bellal" }, avatar: avatar("KB", "#7c5295") },
    featuredImage: cover("Écrans en famille", "#7c5295"),
    tags: [{ fr: "Numérique" }, { fr: "Prévention" }, { fr: "0-6 ans" }, { fr: "Conseils" }],
    readTime: 9,
  },
  {
    id: "3",
    title: { fr: "Préparer sereinement l'entrée en maternelle" },
    excerpt: { fr: "Rituels, séparation, propreté : les conseils des accueillantes des lieux d'accueil enfants-parents du département." },
    slug: "entree-maternelle",
    publishedAt: "2026-03-30",
    author: { name: { fr: "Sophie Danel" }, avatar: avatar("SD", "#2e8b6e") },
    featuredImage: cover("Vers la maternelle", "#2e8b6e"),
    tags: [{ fr: "École" }],
    readTime: 5,
  },
];

export const Grille = () => (
  <BlogListSection
    props={{
      posts,
      layout: "grid",
      columns: 3,
      pagination: false,
      postsPerPage: 9,
    }}
  />
);

export const Liste = () => (
  <BlogListSection
    props={{
      posts: posts.slice(0, 2),
      layout: "list",
      columns: 1,
      pagination: false,
      postsPerPage: 9,
    }}
  />
);

export const GrillePaginee = () => (
  <BlogListSection
    props={{
      posts,
      layout: "grid",
      columns: 2,
      pagination: true,
      postsPerPage: 2,
    }}
  />
);
