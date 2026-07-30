import { SelectObject } from "site-forge";

// États fermés uniquement : la liste s'ouvre dans un Popover (portal fixed),
// hors cellule en capture statique. Les pills (multiple/simple) et le
// placeholder suffisent à montrer le composant. Valeurs = objets {id, name}
// appariés par id (isSameValue).

const structures = [
  { id: "mpe", label: "Maison de la Petite Enfance", type: "association", value: { id: "mpe", name: "Maison de la Petite Enfance" } },
  { id: "ram", label: "Relais Petite Enfance Vallespir", type: "service public", value: { id: "ram", name: "Relais Petite Enfance Vallespir" } },
  { id: "cafe", label: "Café des familles de Prades", type: "collectif", value: { id: "cafe", name: "Café des familles de Prades" } },
  { id: "ludo", label: "Ludothèque La Marelle", type: "association", value: { id: "ludo", name: "Ludothèque La Marelle" } },
];

export const SelectionMultiple = () => (
  <div className="max-w-md">
    <SelectObject
      multiple
      value={[structures[0].value, structures[2].value]}
      onChange={() => {}}
      options={structures}
      placeholder="Choisir des structures…"
      placeholderSearch="Rechercher une structure…"
    />
  </div>
);

export const SelectionSimple = () => (
  <div className="max-w-md">
    <SelectObject
      value={structures[1].value}
      onChange={() => {}}
      options={structures}
      placeholder="Choisir une structure…"
      placeholderSearch="Rechercher une structure…"
    />
  </div>
);

export const Vide = () => (
  <div className="max-w-md">
    <SelectObject
      value={null}
      onChange={() => {}}
      options={structures}
      placeholder="Choisir une structure référente…"
      placeholderSearch="Rechercher une structure…"
    />
  </div>
);
