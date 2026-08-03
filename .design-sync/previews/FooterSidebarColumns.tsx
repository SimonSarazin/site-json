import { FooterSidebarColumns } from "site-forge";

// Footer sidebar + colonnes : bloc marque (logoIcon + description + site web +
// socials en pastilles) puis colonnes de liens ; sous-styles "plain" et "card".
// À 900px la grille passe en 2 colonnes (état responsive réel).
const columnsReseau = [
  {
    title: { fr: "Le réseau" },
    links: [
      { href: "/reseau", label: { fr: "Qui sommes-nous" } },
      { href: "/territoires", label: { fr: "Les dix territoires" } },
      { href: "/partenaires", label: { fr: "Nos partenaires" } },
    ],
  },
  {
    title: { fr: "Participer" },
    links: [
      { href: "/ateliers", label: { fr: "Ateliers parents" } },
      { href: "/benevolat", label: { fr: "Devenir bénévole" } },
      { href: "/agenda", label: { fr: "Agenda" } },
    ],
  },
  {
    title: { fr: "Aide" },
    links: [
      { href: "/faq", label: { fr: "Questions fréquentes" } },
      { href: "/contact", label: { fr: "Nous contacter" } },
    ],
  },
];

export const FondPlein = () => (
  <FooterSidebarColumns
    footer={{
      type: "sidebar-columns",
      logoIcon: "heart-handshake",
      logoTitle: { fr: "Parents 62" },
      description: { fr: "Le réseau qui accompagne les parents du Pas-de-Calais : écoute, entraide et actions près de chez vous." },
      website: "https://parents62.fr",
      socials: [
        { platform: "facebook", url: "https://facebook.com/parents62" },
        { platform: "instagram", url: "https://instagram.com/parents62" },
        { platform: "youtube", url: "https://youtube.com/@parents62" },
      ],
      columns: columnsReseau,
      copyright: { fr: "© 2026 Parents 62" },
      legalLinks: [
        { href: "/mentions-legales", label: { fr: "Mentions légales" } },
        { href: "/confidentialite", label: { fr: "Confidentialité" } },
      ],
    }}
  />
);

export const AspectCarte = () => (
  <FooterSidebarColumns
    style="card"
    footer={{
      type: "sidebar-columns",
      style: "card",
      logoIcon: "waves",
      logoTitle: { fr: "Rézo la Mer" },
      description: { fr: "Entraide et coopération des gens de mer, de Boulogne à Berck." },
      website: "https://rezolamer.fr",
      socials: [
        { platform: "facebook", url: "https://facebook.com/rezolamer" },
        { platform: "linkedin", url: "https://linkedin.com/company/rezolamer" },
      ],
      columns: [
        {
          title: { fr: "Naviguer" },
          links: [
            { href: "/decouvrir", label: { fr: "Découvrir le réseau" } },
            { href: "/ports", label: { fr: "Les ports partenaires" } },
            { href: "/metiers", label: { fr: "Métiers de la mer" } },
          ],
        },
        {
          title: { fr: "Agir" },
          links: [
            { href: "/equipages", label: { fr: "Rejoindre un équipage" } },
            { href: "/sorties", label: { fr: "Proposer une sortie" } },
          ],
        },
      ],
      copyright: { fr: "© 2026 Rézo la Mer" },
      bottomLinks: [{ href: "/mentions-legales", label: { fr: "Mentions légales" } }],
    }}
  />
);
