import { FooterRich } from "site-forge";

// Footer riche : encart newsletter (dégradé primary/secondary), colonnes de
// liens (grille 2 col à 900px), rangée copyright + réseaux sociaux.
export const AvecNewsletter = () => (
  <FooterRich
    footer={{
      type: "rich",
      newsletter: {
        type: "newsletter",
        props: {
          headline: { fr: "La lettre du réseau" },
          subhead: { fr: "Chaque mois : ateliers, rencontres et actualités des dix territoires." },
          formAction: "/newsletter",
          emailPlaceholder: { fr: "Votre adresse e-mail" },
          submitLabel: { fr: "S'abonner" },
        },
      },
      columns: [
        {
          title: { fr: "Le réseau" },
          links: [
            { href: "/reseau", label: { fr: "Qui sommes-nous" } },
            { href: "/territoires", label: { fr: "Les territoires" } },
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
            { href: "mailto:contact@parents62.fr", label: { fr: "Nous écrire" } },
            { href: "https://www.communecter.org", label: { fr: "Communecter" }, external: true },
          ],
        },
      ],
      socials: [
        { platform: "facebook", url: "https://facebook.com/parents62" },
        { platform: "instagram", url: "https://instagram.com/parents62" },
        { platform: "youtube", url: "https://youtube.com/@parents62" },
      ],
      copyright: { fr: "© 2026 Parents 62 — Réseau parentalité du Pas-de-Calais" },
    }}
  />
);

export const SansNewsletter = () => (
  <FooterRich
    footer={{
      type: "rich",
      columns: [
        {
          title: { fr: "Naviguer" },
          links: [
            { href: "/decouvrir", label: { fr: "Découvrir le réseau" } },
            { href: "/ports", label: { fr: "Les ports partenaires" } },
            { href: "/sorties", label: { fr: "Sorties en mer" } },
          ],
        },
        {
          title: { fr: "Informations" },
          links: [
            { href: "/mentions-legales", label: { fr: "Mentions légales" } },
            { href: "/confidentialite", label: { fr: "Confidentialité" } },
          ],
        },
      ],
      socials: [
        { platform: "facebook", url: "https://facebook.com/rezolamer" },
        { platform: "linkedin", url: "https://linkedin.com/company/rezolamer" },
        { platform: "mail", url: "mailto:bonjour@rezolamer.fr" },
      ],
      copyright: { fr: "© 2026 Rézo la Mer — Entraide du littoral" },
    }}
  />
);
