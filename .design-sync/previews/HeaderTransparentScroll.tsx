import type { ReactNode } from "react";
import { HeaderTransparentScroll } from "site-forge";

// Header "transparent-scroll" : nav `fixed` → le wrapper `transform` devient le
// containing block (même astuce que CookieConsentSection) pour capturer la barre
// DANS la cellule. `transparent: false` + `pageHasHero={false}` = barre opaque
// lisible + spacer. La nav desktop est xl-only : à 900px on voit l'état
// tablette réel (marque + burger).
const svg = (s: string) => "data:image/svg+xml," + encodeURIComponent(s);

const logoRond = svg(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#4f46e5"/><text x="32" y="41" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#ffffff" text-anchor="middle">P62</text></svg>'
);

const utilitiesOff = {
  themeSwitch: false,
  langSwitch: false,
  search: false,
  auth: false,
  cart: false,
  notifications: false,
  piggyBank: false,
};

function CadreSite({ children }: { children: ReactNode }) {
  return (
    <div style={{ transform: "translateZ(0)", position: "relative", minHeight: 230 }}>
      {children}
      <div style={{ padding: "24px 32px" }}>
        <p style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>Le réseau des gens de mer</p>
        <p style={{ color: "#64748b", fontSize: 14, marginTop: 8 }}>
          Le contenu de page commence sous la barre : le header opaque pousse la page avec un spacer.
        </p>
      </div>
    </div>
  );
}

export const BarreOpaque = () => (
  <CadreSite>
    <HeaderTransparentScroll
      pageHasHero={false}
      header={{
        type: "transparent-scroll",
        logoIcon: "waves",
        logoIconTone: "primary",
        logoTitle: { fr: "Rézo la Mer" },
        logoSubtitle: { fr: "Entraide du littoral" },
        nav: [
          { label: { fr: "Accueil" }, path: "/" },
          { label: { fr: "Le réseau" }, path: "/reseau" },
          { label: { fr: "Agenda" }, path: "/agenda" },
        ],
        sticky: true,
        transparent: false,
        height: "md",
        utilities: utilitiesOff,
        ctaButton: { label: { fr: "Rejoindre" }, path: "/rejoindre" },
      }}
    />
  </CadreSite>
);

export const MarqueImage = () => (
  <CadreSite>
    <HeaderTransparentScroll
      pageHasHero={false}
      header={{
        type: "transparent-scroll",
        logo: logoRond,
        logoAlt: { fr: "Parents 62" },
        logoTitle: { fr: "Parents 62" },
        logoSubtitle: { fr: "Le réseau qui accompagne les parents" },
        nav: [
          { label: { fr: "Territoires" }, path: "/territoires" },
          { label: { fr: "Ateliers" }, path: "/ateliers" },
          { label: { fr: "Contact" }, path: "/contact" },
        ],
        sticky: true,
        transparent: false,
        height: "md",
        utilities: utilitiesOff,
        urgenceButton: { label: { fr: "Besoin d'aide ?" }, icon: "life-buoy", path: "/aide" },
      }}
    />
  </CadreSite>
);
