import { EntityGrid } from "site-forge";
import { MapPin } from "lucide-react";

// Grille générique du module profil : composant piloté par renderItem.
// ATTENTION i18n : les défauts t("common.search")/t("common.noResults")
// n'existent pas dans modules/profil — toujours passer searchPlaceholder
// et emptyState explicites dans les usages hors app.

type Structure = {
  slug: string;
  name: string;
  type: string;
  locality: string;
  color: string;
  initials: string;
};

const avatar = (bg: string, initials: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="48" fill="${bg}"/><text x="48" y="60" text-anchor="middle" font-family="sans-serif" font-size="34" font-weight="600" fill="#ffffff">${initials}</text></svg>`
  )}`;

const structures: Structure[] = [
  { slug: "centre-social-marais", name: "Centre social du Marais", type: "Centre social", locality: "Calais", color: "#2563eb", initials: "CM" },
  { slug: "la-ribambelle", name: "La Ribambelle — LAEP", type: "Lieu d'accueil enfants-parents", locality: "Arras", color: "#0d9488", initials: "LR" },
  { slug: "maison-ados-bethune", name: "Maison des ados de Béthune", type: "Point accueil écoute jeunes", locality: "Béthune", color: "#b45309", initials: "MA" },
  { slug: "ecole-des-parents-62", name: "École des parents 62", type: "Association départementale", locality: "Lens", color: "#7c3aed", initials: "EP" },
  { slug: "ptits-bouts-opale", name: "Les P'tits Bouts d'Opale", type: "Crèche parentale", locality: "Boulogne-sur-Mer", color: "#be185d", initials: "PB" },
  { slug: "cafe-familles-lens", name: "Café des familles de Lens", type: "Café des parents", locality: "Lens", color: "#4d7c0f", initials: "CF" },
];

const renderStructure = (item: Structure) => (
  <div
    key={item.slug}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: 14,
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
    }}
  >
    <img
      src={avatar(item.color, item.initials)}
      alt=""
      width={44}
      height={44}
      style={{ borderRadius: 999, flexShrink: 0 }}
    />
    <div style={{ minWidth: 0 }}>
      <p style={{ fontWeight: 600, fontSize: 14, color: "var(--foreground)" }}>{item.name}</p>
      <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{item.type}</p>
      <p
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 12,
          color: "var(--muted-foreground)",
        }}
      >
        <MapPin size={12} /> {item.locality}
      </p>
    </div>
  </div>
);

const header = (
  <div>
    <h3 style={{ fontWeight: 600, fontSize: 18, color: "var(--foreground)" }}>Structures membres</h3>
    <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
      6 structures relais dans le Pas-de-Calais
    </p>
  </div>
);

const inert = {
  isFetchingNext: false,
  hasNextPage: false,
  lastItemRef: () => {},
};

export const AvecRecherche = () => (
  <EntityGrid
    items={structures}
    isLoading={false}
    {...inert}
    renderItem={renderStructure}
    columns={{ sm: 1, md: 2, lg: 3 }}
    searchEnabled
    searchValue=""
    onSearchChange={() => {}}
    searchPlaceholder="Rechercher une structure…"
    header={header}
  />
);

export const Chargement = () => (
  <EntityGrid
    items={[]}
    isLoading
    {...inert}
    renderItem={renderStructure}
  />
);

export const Vide = () => (
  <EntityGrid
    items={[]}
    isLoading={false}
    {...inert}
    renderItem={renderStructure}
    emptyState={
      <div style={{ textAlign: "center", padding: "48px 16px" }}>
        <p style={{ fontWeight: 600, color: "var(--foreground)", marginBottom: 6 }}>
          Aucune structure trouvée
        </p>
        <p style={{ fontSize: 14, color: "var(--muted-foreground)" }}>
          Essayez d'élargir votre recherche ou de retirer des filtres.
        </p>
      </div>
    }
  />
);
