import { SearchTextInput } from "site-forge";

// Champ de recherche texte du module search (Input shadcn + icône loupe en
// préfixe, type="search"). Contrôlé : value + onChange(string) obligatoires.

export const Vide = () => (
  <div style={{ maxWidth: 420 }}>
    <SearchTextInput
      placeholder="Rechercher un lieu, une structure, une initiative…"
      value=""
      onChange={() => {}}
    />
  </div>
);

export const Rempli = () => (
  <div style={{ maxWidth: 420 }}>
    <SearchTextInput
      placeholder="Rechercher un lieu, une structure, une initiative…"
      value="café des parents"
      onChange={() => {}}
    />
  </div>
);

// Usage réel : en tête de zone de résultats, pleine largeur dans une barre.
export const BarreDeRecherche = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: 12,
      background: "var(--muted)",
      borderRadius: "var(--radius)",
    }}
  >
    <SearchTextInput
      placeholder="Rechercher dans le réseau…"
      value="tiers-lieu"
      onChange={() => {}}
    />
    <span style={{ fontSize: 14, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
      38 résultats
    </span>
  </div>
);
