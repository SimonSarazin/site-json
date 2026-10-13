import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Bouton « Ajouter » de l'en-tête d'une liste `searchProStatic` (modale d'entité ou création d'answer
 * CoForm, `addButton`). `aria-label` : sous `sm`, le libellé est en `display:none` (hors arbre
 * d'accessibilité) et le bouton n'est plus qu'une icône — même parade que le bouton Carte.
 */
export function SectionAddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" aria-label={label} onClick={onClick}>
      <Plus className="h-4 w-4 sm:mr-1" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
