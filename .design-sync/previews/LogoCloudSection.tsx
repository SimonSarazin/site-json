import { LogoCloudSection } from "site-forge";

// Logos partenaires : data-URI SVG typographiques (jamais d'URL http inventée).
const logo = (text: string, color: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="72"><rect width="220" height="72" rx="10" fill="${color}" opacity="0.14"/><circle cx="38" cy="36" r="14" fill="${color}"/><text x="64" y="42" font-family="Verdana,sans-serif" font-size="17" font-weight="700" fill="${color}">${text}</text></svg>`
  );

// Usage réel : bandeau des partenaires institutionnels (grayscale par défaut,
// couleur restaurée au survol).
export const Partenaires = () => (
  <LogoCloudSection
    props={{
      title: { fr: "Ils font vivre le réseau" },
      subtitle: { fr: "Institutions, fédérations et collectivités engagées aux côtés des familles du Pas-de-Calais." },
      grayscale: true,
      animated: false,
      logos: [
        { src: logo("CAF 62", "#1d4ed8"), alt: { fr: "CAF du Pas-de-Calais" }, href: "https://www.caf.fr" },
        { src: logo("UDAF 62", "#0e7490"), alt: { fr: "UDAF du Pas-de-Calais" } },
        { src: logo("Département 62", "#15803d"), alt: { fr: "Conseil départemental du Pas-de-Calais" } },
        { src: logo("Éduc. Nationale", "#7c3aed"), alt: { fr: "Éducation Nationale" } },
        { src: logo("Centres Sociaux", "#b45309"), alt: { fr: "Fédération des Centres Sociaux" } },
        { src: logo("MSA 59-62", "#be123c"), alt: { fr: "MSA Nord-Pas-de-Calais" } },
      ],
    }}
  />
);

// Sans titre, logos en couleur (grayscale désactivé).
export const Couleur = () => (
  <LogoCloudSection
    props={{
      grayscale: false,
      animated: false,
      logos: [
        { src: logo("CAF 62", "#1d4ed8"), alt: { fr: "CAF du Pas-de-Calais" } },
        { src: logo("UDAF 62", "#0e7490"), alt: { fr: "UDAF du Pas-de-Calais" } },
        { src: logo("Département 62", "#15803d"), alt: { fr: "Conseil départemental du Pas-de-Calais" } },
        { src: logo("Centres Sociaux", "#b45309"), alt: { fr: "Fédération des Centres Sociaux" } },
      ],
    }}
  />
);
