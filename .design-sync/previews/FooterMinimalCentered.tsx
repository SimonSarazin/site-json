import { FooterMinimalCentered } from "site-forge";

// Footer minimal centré : nav horizontale centrée (columns[0].links) + rangée
// copyright / liens légaux. Logo omis à dessein : le composant préfixe
// `footer.logo` par "/" (chemin local attendu) — un data-URI serait cassé.
export const NavigationCentree = () => (
  <FooterMinimalCentered
    footer={{
      type: "minimal-centered",
      columns: [
        {
          title: { fr: "Navigation" },
          links: [
            { href: "/reseau", label: { fr: "Le réseau" } },
            { href: "/territoires", label: { fr: "Territoires" } },
            { href: "/ateliers", label: { fr: "Ateliers" } },
            { href: "/agenda", label: { fr: "Agenda" } },
            { href: "/contact", label: { fr: "Contact" } },
          ],
        },
      ],
      copyright: { fr: "© 2026 Parents 62 — Réseau parentalité du Pas-de-Calais" },
      legalLinks: [
        { href: "/mentions-legales", label: { fr: "Mentions légales" } },
        { href: "/confidentialite", label: { fr: "Politique de confidentialité" } },
      ],
    }}
  />
);

export const LiensBas = () => (
  <FooterMinimalCentered
    footer={{
      type: "minimal-centered",
      columns: [
        {
          title: { fr: "Navigation" },
          links: [
            { href: "/decouvrir", label: { fr: "Découvrir" } },
            { href: "/sorties", label: { fr: "Sorties" } },
            { href: "/adherer", label: { fr: "Adhérer" } },
          ],
        },
      ],
      copyright: { fr: "© 2026 Rézo la Mer" },
      bottomLinks: [
        { href: "/mentions-legales", label: { fr: "Mentions légales" } },
        { href: "/accessibilite", label: { fr: "Accessibilité" } },
        { href: "https://www.communecter.org", label: { fr: "Propulsé par Communecter" } },
      ],
    }}
  />
);
