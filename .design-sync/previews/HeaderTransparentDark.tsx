import type { ReactNode } from "react";
import { HeaderTransparentDark } from "site-forge";

// Header "transparent-dark" : nav `fixed`, transparente sur la home (texte
// blanc, item actif en bg-white/20) → wrapper transform + fond de couverture
// sombre inline. L'item `path: "/"` est actif (MemoryRouter sur "/").
const svg = (s: string) => "data:image/svg+xml," + encodeURIComponent(s);

const logoClair = svg(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="44" viewBox="0 0 160 44"><circle cx="22" cy="22" r="15" fill="#a5b4fc"/><circle cx="34" cy="12" r="6" fill="#e0e7ff"/><text x="48" y="28" font-family="Arial, sans-serif" font-size="17" font-weight="bold" fill="#ffffff">Parents 62</text></svg>'
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

function Couverture({ children, fond }: { children: ReactNode; fond: string }) {
  return (
    <div style={{ transform: "translateZ(0)", position: "relative", minHeight: 220, background: fond }}>
      {children}
      <div style={{ padding: "110px 32px 28px" }}>
        <p style={{ color: "#ffffff", fontWeight: 700, fontSize: 22, margin: 0 }}>
          Écoute, entraide et actions près de chez vous
        </p>
        <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, marginTop: 8 }}>
          Sur les dix territoires du département.
        </p>
      </div>
    </div>
  );
}

export const SurCouverture = () => (
  <Couverture fond="linear-gradient(150deg, #312e81 0%, #4c1d95 80%)">
    <HeaderTransparentDark
      header={{
        type: "transparent-dark",
        logoIcon: "heart-handshake",
        logoIconTone: "white",
        logoTitle: { fr: "Parents 62" },
        nav: [
          { label: { fr: "Accueil" }, path: "/" },
          { label: { fr: "Le réseau" }, path: "/reseau" },
          { label: { fr: "Ateliers" }, path: "/ateliers" },
          { label: { fr: "Contact" }, path: "/contact" },
        ],
        sticky: true,
        transparent: true,
        height: "md",
        utilities: utilitiesOff,
      }}
    />
  </Couverture>
);

export const MarqueClaire = () => (
  <Couverture fond="linear-gradient(150deg, #164e63 0%, #083344 80%)">
    <HeaderTransparentDark
      header={{
        type: "transparent-dark",
        logo: logoClair,
        logoAlt: { fr: "Parents 62" },
        nav: [
          { label: { fr: "Territoires" }, path: "/territoires" },
          { label: { fr: "Agenda" }, path: "/agenda", badge: { text: { fr: "Nouveau" } } },
          { label: { fr: "Adhérer" }, path: "/adherer" },
        ],
        sticky: true,
        transparent: true,
        height: "md",
        utilities: utilitiesOff,
      }}
    />
  </Couverture>
);
