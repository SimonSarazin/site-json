import type { ReactNode } from "react";
import { HeaderUnderlineNav } from "site-forge";

// Header "underline-nav" : nav `fixed`, transparente sur la home non scrollée
// (texte blanc) → le wrapper transform sert de containing block ET porte un
// fond héro sombre inline pour rendre la barre lisible (état overlay réel).
// Thème DÉFAUT : --primary est quasi-noir → l'item actif (text-primary) et la
// pastille urgence (accent/20 + text-primary) sont illisibles sur héros sombres ;
// ce design vit avec des thèmes à primary vif. Stories calées sur l'état lisible
// (aucun item actif, logoIconTone white, CTA bg-primary = pilule sombre).
const utilitiesOff = {
  themeSwitch: false,
  langSwitch: false,
  search: false,
  auth: false,
  cart: false,
  notifications: false,
  piggyBank: false,
};

function HeroSombre({ children, fond }: { children: ReactNode; fond: string }) {
  return (
    <div style={{ transform: "translateZ(0)", position: "relative", minHeight: 230, background: fond }}>
      {children}
      <div style={{ padding: "116px 32px 28px" }}>
        <p style={{ color: "#ffffff", fontWeight: 700, fontSize: 22, margin: 0 }}>
          Un littoral qui fait réseau
        </p>
        <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, marginTop: 8 }}>
          La barre transparente se pose sur le héro ; elle devient opaque au scroll.
        </p>
      </div>
    </div>
  );
}

export const SurHero = () => (
  <HeroSombre fond="linear-gradient(160deg, #0c4a6e 0%, #082f49 70%)">
    <HeaderUnderlineNav
      header={{
        type: "underline-nav",
        logoIcon: "waves",
        logoIconTone: "white",
        logoTitle: { fr: "Rézo la Mer" },
        nav: [
          { label: { fr: "Le réseau" }, path: "/reseau" },
          { label: { fr: "Sorties" }, path: "/sorties" },
          { label: { fr: "Agenda" }, path: "/agenda" },
        ],
        sticky: true,
        transparent: true,
        height: "md",
        utilities: utilitiesOff,
        ctaButton: { label: { fr: "Rejoindre le réseau" }, path: "/rejoindre" },
      }}
    />
  </HeroSombre>
);

export const AvecBadge = () => (
  <HeroSombre fond="linear-gradient(160deg, #312e81 0%, #1e1b4b 70%)">
    <HeaderUnderlineNav
      header={{
        type: "underline-nav",
        logoIcon: "heart-handshake",
        logoIconTone: "white",
        logoTitle: { fr: "Parents 62" },
        nav: [
          { label: { fr: "Territoires" }, path: "/territoires" },
          { label: { fr: "Ateliers" }, path: "/ateliers", badge: { text: { fr: "Nouveau" } } },
        ],
        sticky: true,
        transparent: true,
        height: "md",
        utilities: utilitiesOff,
        ctaButton: { label: { fr: "Adhérer" }, path: "/adherer" },
      }}
    />
  </HeroSombre>
);
