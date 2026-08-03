import type { ReactNode } from "react";
import { MobileMenuSheet } from "site-forge";

// Burger de menu mobile (wrapper Sheet/Radix Dialog). En capture le tiroir est
// FERMÉ : on montre le trigger. `breakpoint="xl"` (xl:hidden) garde le burger
// visible à 900px — le défaut `md` le masquerait à cette largeur.
const Barre = ({ sombre, children }: { sombre?: boolean; children: ReactNode }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 16px",
      borderRadius: 10,
      background: sombre ? "#0c4a6e" : "transparent",
      border: sombre ? "none" : "1px solid #e2e8f0",
    }}
  >
    <span style={{ fontWeight: 700, fontSize: 15, color: sombre ? "#ffffff" : "inherit" }}>
      Rézo la Mer
    </span>
    {children}
  </div>
);

const liens = (close: () => void) => (
  <nav style={{ display: "grid", gap: 8 }}>
    {["Accueil", "Le réseau", "Agenda", "Contact"].map((label) => (
      <button key={label} type="button" onClick={close} style={{ textAlign: "left", background: "none", border: 0, padding: "6px 0", font: "inherit" }}>
        {label}
      </button>
    ))}
  </nav>
);

export const BoutonFerme = () => (
  <div style={{ padding: 12 }}>
    <Barre>
      <MobileMenuSheet breakpoint="xl">{liens}</MobileMenuSheet>
    </Barre>
  </div>
);

export const SurBarreSombre = () => (
  <div style={{ padding: 12 }}>
    <Barre sombre>
      <MobileMenuSheet breakpoint="xl" tone="onColor">
        {liens}
      </MobileMenuSheet>
    </Barre>
  </div>
);
