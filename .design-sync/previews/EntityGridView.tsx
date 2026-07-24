import { EntityGridView } from "site-forge";
import { MapPin, PartyPopper, Users } from "lucide-react";

// Vue grille/détails du module profil : tout le texte des états (vide, fin,
// chargement) passe par les props — le composant lit seulement les libellés
// des boutons Grille/Détails dans modules/profil (déjà embarqué au bundle).

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

// 4 items (2 rangées) : la carte de fin de liste doit rester visible dans la
// hauteur de cellule de capture.
const structures: Structure[] = [
  { slug: "centre-social-marais", name: "Centre social du Marais", type: "Centre social", locality: "Calais", color: "#2563eb", initials: "CM" },
  { slug: "la-ribambelle", name: "La Ribambelle — LAEP", type: "Accueil enfants-parents", locality: "Arras", color: "#0d9488", initials: "LR" },
  { slug: "maison-ados-bethune", name: "Maison des ados de Béthune", type: "Écoute jeunes", locality: "Béthune", color: "#b45309", initials: "MA" },
  { slug: "ecole-des-parents-62", name: "École des parents 62", type: "Association départementale", locality: "Lens", color: "#7c3aed", initials: "EP" },
];

const gridCard = (item: Structure) => (
  <div
    key={item.slug}
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 8,
      padding: "20px 14px",
      textAlign: "center",
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
    }}
  >
    <img src={avatar(item.color, item.initials)} alt="" width={56} height={56} style={{ borderRadius: 999 }} />
    <div>
      <p style={{ fontWeight: 600, fontSize: 14, color: "var(--foreground)" }}>{item.name}</p>
      <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{item.type}</p>
    </div>
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12,
        color: "var(--muted-foreground)",
      }}
    >
      <MapPin size={12} /> {item.locality}
    </span>
  </div>
);

const detailedCard = (item: Structure) => (
  <div
    key={item.slug}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: 16,
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
    }}
  >
    <img src={avatar(item.color, item.initials)} alt="" width={44} height={44} style={{ borderRadius: 999 }} />
    <div>
      <p style={{ fontWeight: 600, fontSize: 14, color: "var(--foreground)" }}>{item.name}</p>
      <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
        {item.type} · {item.locality}
      </p>
    </div>
  </div>
);

const textes = {
  emptyTitle: "Aucune structure pour le moment",
  emptyDescription: "Les structures membres du réseau apparaîtront ici dès leur inscription.",
  loadingText: "Chargement des structures…",
  allLoadedTitle: "Tout le réseau est affiché",
  allLoadedDescription: "4 structures membres du réseau parentalité du Pas-de-Calais.",
};

const icones = {
  emptyIcon: <Users size={44} style={{ margin: "0 auto" }} />,
  endIcon: <PartyPopper size={22} color="var(--primary)" />,
};

export const Grille = () => (
  <EntityGridView
    items={structures}
    isLoading={false}
    isFetchingNextPage={false}
    hasNextPage={false}
    renderGridItem={gridCard}
    renderDetailedItem={detailedCard}
    {...icones}
    {...textes}
    canCreate
    createLabel="Ajouter une structure"
    onCreateClick={() => {}}
    searchEnabled
    onSearchChange={() => {}}
  />
);

export const ChargementInitial = () => (
  <EntityGridView
    items={[]}
    isLoading
    isFetchingNextPage={false}
    renderGridItem={gridCard}
    {...icones}
    {...textes}
  />
);

export const Vide = () => (
  <EntityGridView
    items={[]}
    isLoading={false}
    isFetchingNextPage={false}
    renderGridItem={gridCard}
    {...icones}
    {...textes}
    canCreate
    createLabel="Ajouter une structure"
    onCreateClick={() => {}}
  />
);
