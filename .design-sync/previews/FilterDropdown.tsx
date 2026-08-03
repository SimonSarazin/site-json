import { useEffect, useRef } from "react";
import { FilterDropdown } from "site-forge";

// Filtre multi-sélection du module search : Button outline + chevron qui
// ouvre un MultiCombobox (Popover + Command, coche à droite, reste ouvert
// pendant la sélection). `list` accepte un tableau de chaînes OU un objet
// { valeur: libellé localisé } ; `count` ajoute « (n) » aux options.

const thematiques = [
  "Parentalité",
  "Éducation populaire",
  "Inclusion numérique",
  "Alimentation durable",
  "Culture & loisirs",
];

const compte: Record<string, number> = {
  Parentalité: 42,
  "Éducation populaire": 27,
  "Inclusion numérique": 18,
  "Alimentation durable": 12,
  "Culture & loisirs": 9,
};

// Barre de filtres fermée, telle qu'affichée au-dessus des résultats.
export const BarreDeFiltres = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
    <FilterDropdown name="Thématiques" list={thematiques} selected={["Parentalité"]} onChange={() => {}} />
    <FilterDropdown
      name="Public"
      list={{ enfants: { fr: "Enfants" }, ados: { fr: "Adolescents" }, parents: { fr: "Parents" } }}
      selected={[]}
      onChange={() => {}}
    />
    <FilterDropdown name="Territoire" list={["Brest", "Quimper", "Morlaix", "Lannion"]} selected={[]} onChange={() => {}} />
    <span style={{ fontSize: 14, color: "var(--muted-foreground)", marginLeft: 4 }}>
      128 structures trouvées
    </span>
  </div>
);

// Panneau déplié (ouvert au montage pour la capture) : coches sur les valeurs
// sélectionnées, compteurs « (n) » issus de `count`.
export const PanneauOuvert = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector("button")?.click();
  }, []);
  return (
    <div ref={ref} style={{ minHeight: 300 }}>
      <FilterDropdown
        name="Thématiques"
        list={thematiques}
        selected={["Parentalité", "Inclusion numérique"]}
        onChange={() => {}}
        count={compte}
      />
    </div>
  );
};
