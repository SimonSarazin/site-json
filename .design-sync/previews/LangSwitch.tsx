import type { ReactNode } from "react";
import { LangSwitch } from "site-forge";

// Sélecteur de langue d'en-tête (trigger Globe + locale courante ; menu fermé
// en capture). Le DsProvider n'impose pas de liste → repli LOCALES (4 locales),
// donc le composant rend bien (il rendrait `null` avec ≤ 1 locale).
// Mise en situation : petite barre d'en-tête factice en styles inline.
const Barre = ({ sombre, children }: { sombre?: boolean; children: ReactNode }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 16px",
      borderRadius: 10,
      background: sombre ? "#1e1b4b" : "transparent",
      border: sombre ? "none" : "1px solid #e2e8f0",
    }}
  >
    <span style={{ fontWeight: 700, fontSize: 15, color: sombre ? "#ffffff" : "inherit" }}>
      Parents 62
    </span>
    {children}
  </div>
);

export const DansBarreClaire = () => (
  <div style={{ padding: 12 }}>
    <Barre>
      <LangSwitch />
    </Barre>
  </div>
);

export const SurBarreSombre = () => (
  <div style={{ padding: 12 }}>
    <Barre sombre>
      <LangSwitch tone="onColor" />
    </Barre>
  </div>
);
