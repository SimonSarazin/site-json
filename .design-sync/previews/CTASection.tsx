import { CTASection } from "site-forge";

// Type "cta" — usage réel : bas de page parent62 (« Une question ? ») et home
// config.prod.json. IMPORTANT : le fond passe dans un url(...) CSS non quoté →
// le data-URI ne doit contenir ni parenthèse ni apostrophe (formes plates, hex).
const soireeBg =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="600"><rect width="100%" height="100%" fill="#2b3a67"/><circle cx="300" cy="150" r="180" fill="#3d5088" opacity="0.6"/><circle cx="1350" cy="450" r="220" fill="#1d2947" opacity="0.7"/></svg>'
  );

export const Simple = () => (
  <CTASection
    props={{
      headline: { fr: "Une question sur la parentalité ?" },
      subhead: { fr: "La coordination de votre territoire vous répond et vous oriente gratuitement." },
      buttons: [
        { label: { fr: "Contacter le réseau" }, href: "/contact", variant: "default" },
        { label: { fr: "Voir les territoires" }, href: "/territoires", variant: "outline" },
      ],
      align: "center",
    }}
  />
);

export const AvecImage = () => (
  <CTASection
    props={{
      headline: { fr: "Rejoignez le Mois de la parentalité" },
      subhead: { fr: "Plus de 200 rendez-vous gratuits partout dans le département, tout au long de novembre." },
      backgroundImage: soireeBg,
      // NB : variant "outline" + backgroundImage rend le libellé invisible
      // (text-background sur bg-background) — bug composant, évité ici.
      buttons: [
        { label: { fr: "Découvrir le programme" }, href: "/mois-parentalite", variant: "default" },
        { label: { fr: "Proposer une action" }, href: "/proposer", variant: "secondary" },
      ],
      align: "center",
    }}
  />
);

export const FondColoreGauche = () => (
  <CTASection
    props={{
      headline: { fr: "Votre tiers-lieu n'est pas référencé ?" },
      subhead: { fr: "Ajoutez-le à la cartographie nationale en quelques minutes." },
      backgroundColor: "#e8eefb",
      buttons: [{ label: { fr: "Référencer mon lieu" }, href: "/ajouter", variant: "default" }],
      align: "left",
    }}
  />
);
