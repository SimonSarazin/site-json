import { Badge, Button, Label, MultiCombobox } from "site-forge";
import { ChevronsUpDown, SlidersHorizontal } from "lucide-react";

// Combobox multi-sélection (Popover + Command) — filtres de recherche du
// réseau. Le panneau ouvert passe par un portal Radix et déborderait de la
// cellule : on montre les DÉCLENCHEURS fermés, remplis de façon réaliste
// (compteur de sélection). Le popover reste ouvert pendant la
// multi-sélection en usage réel.

const thematiques = [
  { id: "alimentation", label: "Alimentation durable" },
  { id: "education", label: "Éducation & jeunesse" },
  { id: "culture", label: "Culture" },
  { id: "numerique", label: "Inclusion numérique" },
];

export const FiltreAvecSelection = () => (
  <div className="max-w-sm space-y-2">
    <Label>Thématiques</Label>
    <MultiCombobox
      options={thematiques}
      selected={["alimentation", "numerique"]}
      onToggle={() => {}}
      allLabel="Toutes les thématiques"
      onClear={() => {}}
    >
      <Button variant="outline" className="w-full justify-between font-normal">
        <span className="flex items-center gap-2">
          Thématiques
          <Badge variant="secondary">2</Badge>
        </span>
        <ChevronsUpDown className="size-4 opacity-50" />
      </Button>
    </MultiCombobox>
  </div>
);

export const FiltreVide = () => (
  <div className="max-w-sm space-y-2">
    <Label>Public concerné</Label>
    <MultiCombobox
      options={[
        { id: "enfants", label: "Enfants" },
        { id: "ados", label: "Adolescents" },
        { id: "adultes", label: "Adultes" },
        { id: "seniors", label: "Seniors" },
      ]}
      selected={[]}
      onToggle={() => {}}
      allLabel="Tous les publics"
      onClear={() => {}}
    >
      <Button variant="outline" className="text-muted-foreground w-full justify-between font-normal">
        Tous les publics
        <ChevronsUpDown className="size-4 opacity-50" />
      </Button>
    </MultiCombobox>
  </div>
);

export const DeclencheurCompact = () => (
  <div className="flex items-center gap-2">
    <MultiCombobox
      options={thematiques}
      selected={["culture"]}
      onToggle={() => {}}
    >
      <Button variant="outline" size="sm">
        <SlidersHorizontal className="size-4" />
        Filtres
        <Badge variant="secondary">1</Badge>
      </Button>
    </MultiCombobox>
    <p className="text-muted-foreground text-sm">42 initiatives trouvées</p>
  </div>
);
