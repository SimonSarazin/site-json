import { Skeleton } from "site-forge";

// Chargement d'une fiche annuaire : avatar rond + deux lignes.
export const FicheEnChargement = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
    <Skeleton className="rounded-full" style={{ width: 48, height: 48 }} />
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Skeleton style={{ width: 220, height: 16 }} />
      <Skeleton style={{ width: 160, height: 12 }} />
    </div>
  </div>
);

// Chargement d'une carte de tiers-lieu : visuel + titre + texte.
export const CarteEnChargement = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 320 }}>
    <Skeleton className="rounded-xl" style={{ width: "100%", height: 140 }} />
    <Skeleton style={{ width: "70%", height: 16 }} />
    <Skeleton style={{ width: "100%", height: 12 }} />
    <Skeleton style={{ width: "85%", height: 12 }} />
  </div>
);

// Chargement d'une liste de résultats (3 rangées).
export const ListeEnChargement = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 360 }}>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Skeleton className="rounded-md" style={{ width: 40, height: 40 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <Skeleton style={{ width: "60%", height: 12 }} />
          <Skeleton style={{ width: "40%", height: 10 }} />
        </div>
      </div>
    ))}
  </div>
);
