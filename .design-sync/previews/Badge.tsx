import { Badge } from "site-forge";

// Les 4 variantes shadcn sur des statuts d'annuaire.
export const Variants = () => (
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
    <Badge>Tiers-lieu labellisé</Badge>
    <Badge variant="secondary">En cours d'ouverture</Badge>
    <Badge variant="destructive">Fermé définitivement</Badge>
    <Badge variant="outline">Non vérifié</Badge>
  </div>
);

// Nuage de thématiques (usage tags de l'annuaire).
export const Thematiques = () => (
  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxWidth: 360 }}>
    <Badge variant="outline">Coworking</Badge>
    <Badge variant="outline">Fablab</Badge>
    <Badge variant="outline">Parentalité</Badge>
    <Badge variant="outline">Agriculture urbaine</Badge>
    <Badge variant="outline">Culture</Badge>
    <Badge variant="outline">Inclusion numérique</Badge>
    <Badge variant="outline">Économie circulaire</Badge>
  </div>
);

// Badge avec icône SVG (slot [&>svg]:size-3) et badge compteur.
export const AvecIcone = () => (
  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
    <Badge>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
      Boulogne-sur-Mer
    </Badge>
    <Badge variant="secondary">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 2v4M16 2v4M3 10h18" />
        <rect x="3" y="4" width="18" height="18" rx="2" />
      </svg>
      12 ateliers à venir
    </Badge>
  </div>
);
