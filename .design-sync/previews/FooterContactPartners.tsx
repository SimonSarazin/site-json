import { FooterContactPartners } from "site-forge";

// Footer contacts + partenaires : `contactSection` OBLIGATOIRE (items avec
// icône/label/lines/value), logos partenaires en data-URI SVG (les data: passent
// par le bypass OptimizedImage). Rangée basse copyright + liens légaux.
const svg = (s: string) => "data:image/svg+xml," + encodeURIComponent(s);

const logoPartenaire = (texte: string, fond: string, encre: string) =>
  svg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="96" viewBox="0 0 160 96"><rect x="4" y="4" width="152" height="88" rx="12" fill="${fond}"/><text x="80" y="55" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="${encre}" text-anchor="middle">${texte}</text></svg>`
  );

export const CoordonneesEtPartenaires = () => (
  <FooterContactPartners
    footer={{
      type: "contact-partners",
      contactSection: {
        title: { fr: "Nous contacter" },
        items: [
          {
            icon: "map-pin",
            label: { fr: "Maison du réseau" },
            lines: [{ fr: "12 rue des Tilleuls" }, { fr: "62000 Arras" }],
          },
          {
            icon: "phone",
            label: { fr: "Téléphone" },
            value: { fr: "03 21 00 00 62" },
            href: "tel:+33321000062",
          },
          {
            icon: "mail",
            label: { fr: "Courriel" },
            value: { fr: "contact@parents62.fr" },
            href: "mailto:contact@parents62.fr",
          },
        ],
      },
      partners: {
        title: { fr: "Ils nous soutiennent" },
        logos: [
          { image: logoPartenaire("CAF 62", "#eef2ff", "#4338ca"), alt: { fr: "CAF du Pas-de-Calais" }, href: "https://caf.fr" },
          { image: logoPartenaire("MSA", "#ecfdf5", "#047857"), alt: { fr: "MSA Nord-Pas de Calais" }, href: "https://msa.fr" },
          { image: logoPartenaire("Dépt 62", "#fff7ed", "#c2410c"), alt: { fr: "Département du Pas-de-Calais" } },
        ],
      },
      copyright: { fr: "© 2026 Parents 62 — Réseau parentalité du Pas-de-Calais" },
      legalLinks: [
        { href: "/mentions-legales", label: { fr: "Mentions légales" } },
        { href: "/confidentialite", label: { fr: "Confidentialité" } },
      ],
    }}
  />
);

export const PartenaireUnique = () => (
  <FooterContactPartners
    footer={{
      type: "contact-partners",
      contactSection: {
        title: { fr: "La capitainerie du réseau" },
        items: [
          {
            icon: "map-pin",
            lines: [{ fr: "Quai Gambetta" }, { fr: "62200 Boulogne-sur-Mer" }],
          },
          {
            icon: "mail",
            value: { fr: "bonjour@rezolamer.fr" },
            href: "mailto:bonjour@rezolamer.fr",
          },
        ],
      },
      partners: {
        logos: [
          { image: logoPartenaire("Région HDF", "#f0f9ff", "#0369a1"), alt: { fr: "Région Hauts-de-France" }, href: "https://hautsdefrance.fr" },
        ],
      },
      copyright: { fr: "© 2026 Rézo la Mer" },
    }}
  />
);
