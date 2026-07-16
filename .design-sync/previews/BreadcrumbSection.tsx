import { BreadcrumbSection } from "site-forge";

// Type "breadcrumb" — usage réel : /showcase de config.prod.json.
export const DeuxNiveaux = () => (
  <BreadcrumbSection
    props={{
      items: [
        { label: { fr: "Accueil" }, href: "/" },
        { label: { fr: "Les tiers-lieux" } },
      ],
      separator: "/",
    }}
  />
);

export const TroisNiveauxChevron = () => (
  <BreadcrumbSection
    props={{
      items: [
        { label: { fr: "Accueil" }, href: "/" },
        { label: { fr: "Thèmes" }, href: "/themes" },
        { label: { fr: "La petite enfance" } },
      ],
      separator: "›",
    }}
  />
);
