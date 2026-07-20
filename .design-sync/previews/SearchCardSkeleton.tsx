import { SearchCardSkeleton } from "site-forge";

// Squelette d'une carte de résultat de recherche : Card ratio 4/3 entièrement
// recouverte d'un Skeleton (placeholder de SearchCard pendant le chargement).
// Aucune prop. L'animation pulse est gelée par le harnais de capture.

export const Seule = () => (
  <div style={{ maxWidth: 320 }}>
    <SearchCardSkeleton />
  </div>
);

// Densité standard : la grille de résultats (3 colonnes desktop).
export const GrilleTroisColonnes = () => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
    {Array.from({ length: 6 }).map((_, i) => (
      <SearchCardSkeleton key={i} />
    ))}
  </div>
);

// Densité compacte : 4 colonnes serrées (annuaire dense).
export const GrilleCompacte = () => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
    {Array.from({ length: 4 }).map((_, i) => (
      <SearchCardSkeleton key={i} />
    ))}
  </div>
);
