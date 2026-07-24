import { SearchListSkeleton } from "site-forge";

// État de chargement d'une liste de résultats : grille FIXE de 6
// SearchCardSkeleton (1 col mobile / 2 cols md / 3 cols lg — media queries
// viewport). Aucune prop.

// maxWidth : pleine largeur, la grille de 6 cartes 4/3 (2 col au viewport de
// capture) dépasse la hauteur de cellule — largeur bornée pour montrer le
// motif entier (les colonnes restent pilotées par le viewport).
export const ParDefaut = () => (
  <div style={{ maxWidth: 540 }}>
    <SearchListSkeleton />
  </div>
);

// En situation : en-tête de page de recherche pendant le chargement.
export const PendantUneRecherche = () => (
  <div style={{ maxWidth: 540, display: "flex", flexDirection: "column", gap: 12 }}>
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700 }}>Les lieux du réseau</h2>
      <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Chargement…</span>
    </div>
    <SearchListSkeleton />
  </div>
);
