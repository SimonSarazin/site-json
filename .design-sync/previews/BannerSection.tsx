import { BannerSection } from "site-forge";

// Type "banner" — bandeau d'annonce fin (info/success/warning/error), usage
// réel : page /showcase de config.prod.json.
export const Info = () => (
  <BannerSection
    props={{
      text: { fr: "Le Mois de la parentalité revient en novembre : le programme complet arrive bientôt." },
      variant: "info",
      dismissible: false,
    }}
  />
);

export const Succes = () => (
  <BannerSection
    props={{
      text: { fr: "Votre inscription à la rencontre départementale est bien confirmée." },
      variant: "success",
      dismissible: false,
    }}
  />
);

export const AvertissementFermable = () => (
  <BannerSection
    props={{
      text: { fr: "Maintenance prévue jeudi de 7 h à 9 h : la carte des lieux sera indisponible." },
      variant: "warning",
      dismissible: true,
    }}
  />
);

export const Erreur = () => (
  <BannerSection
    props={{
      text: { fr: "Le service d'envoi de messages est momentanément interrompu." },
      variant: "error",
      dismissible: false,
    }}
  />
);
