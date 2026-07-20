import { ToggleGroup, ToggleGroupItem } from "site-forge";
import { CalendarDays, LayoutGrid, List, Map } from "lucide-react";

// defaultValue pour figer les sélections (data-[state=on]:bg-accent) —
// capture statique sans interaction.

export const ChoixUnique = () => (
  <ToggleGroup type="single" defaultValue="liste" variant="outline">
    <ToggleGroupItem value="liste" aria-label="Vue liste">
      <List />
      Liste
    </ToggleGroupItem>
    <ToggleGroupItem value="grille" aria-label="Vue grille">
      <LayoutGrid />
      Grille
    </ToggleGroupItem>
    <ToggleGroupItem value="carte" aria-label="Vue carte">
      <Map />
      Carte
    </ToggleGroupItem>
    <ToggleGroupItem value="agenda" aria-label="Vue agenda">
      <CalendarDays />
      Agenda
    </ToggleGroupItem>
  </ToggleGroup>
);

export const SelectionMultiple = () => (
  <ToggleGroup type="multiple" defaultValue={["ateliers", "permanences"]}>
    <ToggleGroupItem value="ateliers">Ateliers</ToggleGroupItem>
    <ToggleGroupItem value="permanences">Permanences</ToggleGroupItem>
    <ToggleGroupItem value="sorties">Sorties</ToggleGroupItem>
    <ToggleGroupItem value="conferences">Conférences</ToggleGroupItem>
  </ToggleGroup>
);

export const PetiteTaille = () => (
  <ToggleGroup type="single" defaultValue="mois" variant="outline" size="sm">
    <ToggleGroupItem value="jour">Jour</ToggleGroupItem>
    <ToggleGroupItem value="semaine">Semaine</ToggleGroupItem>
    <ToggleGroupItem value="mois">Mois</ToggleGroupItem>
  </ToggleGroup>
);
