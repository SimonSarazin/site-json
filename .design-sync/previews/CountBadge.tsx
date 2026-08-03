import { CountBadge } from "site-forge";

// Compteur pour onglets et listes du module profil. count=0 sans showZero
// ne rend RIEN (null) — d'où la cellule dédiée au comportement zéro.

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 14,
  color: "var(--foreground)",
};

export const SurOnglets = () => (
  <div style={{ display: "flex", gap: 24, borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
    <span style={{ ...row, fontWeight: 600, color: "var(--primary)" }}>
      Membres
      <CountBadge count={42} />
    </span>
    <span style={row}>
      Projets
      <CountBadge count={3} variant="outline" />
    </span>
    <span style={row}>
      En attente
      <CountBadge count={2} colorScheme="orange" />
    </span>
    <span style={row}>
      Invitations
      <CountBadge count={0} />
      <em style={{ fontSize: 12, color: "var(--muted-foreground)" }}>(0 → masqué)</em>
    </span>
  </div>
);

export const CouleursPersonnalisees = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 320 }}>
    <span style={row}>Demandes reçues <CountBadge count={5} colorScheme="orange" /></span>
    <span style={row}>Messages non lus <CountBadge count={12} colorScheme="blue" /></span>
    <span style={row}>Actions validées <CountBadge count={8} colorScheme="green" /></span>
    <span style={row}>Signalements <CountBadge count={1} colorScheme="red" /></span>
    <span style={row}>Archivés <CountBadge count={27} colorScheme="muted" /></span>
  </div>
);

export const VariantesShadcn = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
    <span style={row}>default <CountBadge count={7} variant="default" /></span>
    <span style={row}>secondary <CountBadge count={7} variant="secondary" /></span>
    <span style={row}>destructive <CountBadge count={7} variant="destructive" /></span>
    <span style={row}>outline <CountBadge count={7} variant="outline" /></span>
    <span style={row}>zéro affiché <CountBadge count={0} showZero /></span>
  </div>
);
