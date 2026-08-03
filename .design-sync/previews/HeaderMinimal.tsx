import type { ReactNode } from "react";
import { HeaderMinimal } from "site-forge";

// Header compact (design "minimal") : nav `fixed` (wrapper transform = containing
// block), barre bg-background/90 bordée, libellés uppercase espacés. Nav desktop
// visible dès md → complète à 900px.
const svg = (s: string) => "data:image/svg+xml," + encodeURIComponent(s);

const logoRond = svg(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#0e7490"/><path d="M14 38 q6 -7 12 0 q6 7 12 0 q6 -7 12 0" stroke="#ffffff" stroke-width="3.5" fill="none" stroke-linecap="round"/></svg>'
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
    <div style={{ transform: "translateZ(0)", position: "relative", minHeight: 130 }}>
      {children}
      <div style={{ padding: "96px 32px 16px" }}>
        <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>Contenu de page sous la barre fixe.</p>
      </div>
    </div>
  );
}

export const Reseau = () => (
  <CadreSite>
    <HeaderMinimal
      header={{
        type: "minimal",
        logoIcon: "heart-handshake",
        logoTitle: { fr: "Parents 62" },
        nav: [
          { label: { fr: "Le réseau" }, path: "/reseau" },
          { label: { fr: "Territoires" }, path: "/territoires" },
          { label: { fr: "Ateliers" }, path: "/ateliers" },
          { label: { fr: "Contact" }, path: "/contact" },
        ],
        sticky: true,
        transparent: false,
        height: "md",
        utilities: utilitiesOff,
      }}
    />
  </CadreSite>
);

export const Littoral = () => (
  <CadreSite>
    <HeaderMinimal
      header={{
        type: "minimal",
        logo: logoRond,
        logoAlt: { fr: "Rézo la Mer" },
        logoTitle: { fr: "Rézo la Mer" },
        nav: [
          { label: { fr: "Découvrir" }, path: "/decouvrir" },
          { label: { fr: "Sorties" }, path: "/sorties", badge: { text: { fr: "Été" } } },
          { label: { fr: "Adhérer" }, path: "/adherer" },
        ],
        sticky: true,
        transparent: false,
        height: "md",
        utilities: utilitiesOff,
      }}
    />
  </CadreSite>
);
