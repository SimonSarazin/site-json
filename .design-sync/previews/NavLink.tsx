import { NavLink } from "site-forge";

// Lien de chrome partagé (headers + footers) — 4 rendus selon `to` :
// interne (Link SPA), externe http(s) (nouvel onglet), mailto:/tel: (ancre
// simple), "#"/vide (span inerte). Glue en styles inline (CSS précompilé).
const Ligne = ({ titre, children }: { titre: string; children: React.ReactNode }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
    <span style={{ width: 190, flexShrink: 0, color: "#64748b", fontSize: 13 }}>{titre}</span>
    {children}
  </div>
);

export const QuatreCas = () => (
  <div style={{ display: "grid", gap: 14, padding: 16, fontSize: 15 }}>
    <Ligne titre="Interne (Link SPA)">
      <NavLink to="/ateliers" className="text-primary underline">
        Nos ateliers parents
      </NavLink>
    </Ligne>
    <Ligne titre="Externe (nouvel onglet)">
      <NavLink to="https://www.communecter.org" className="text-primary underline">
        Communecter
      </NavLink>
    </Ligne>
    <Ligne titre="mailto: (ancre simple)">
      <NavLink to="mailto:contact@parents62.fr" className="text-primary underline">
        contact@parents62.fr
      </NavLink>
    </Ligne>
    <Ligne titre='Placeholder "#" (span inerte)'>
      <NavLink to="#" className="text-muted-foreground">
        Bientôt disponible
      </NavLink>
    </Ligne>
  </div>
);

export const EtatActif = () => (
  <div style={{ display: "flex", gap: 24, padding: 16, fontSize: 15 }}>
    {/* L'état actif est calculé par l'appelant (header) : className + ariaCurrent. */}
    <NavLink to="/reseau" ariaCurrent="page" className="text-primary font-semibold underline">
      Le réseau
    </NavLink>
    <NavLink to="/territoires" className="text-muted-foreground">
      Territoires
    </NavLink>
    <NavLink to="/contact" className="text-muted-foreground">
      Contact
    </NavLink>
  </div>
);
