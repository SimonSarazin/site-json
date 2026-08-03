import { ScrollArea, ScrollBar, Separator, Badge } from "site-forge";

const communes = [
  "Arras", "Auxi-le-Château", "Béthune", "Boulogne-sur-Mer", "Bruay-la-Buissière",
  "Calais", "Desvres", "Étaples", "Hénin-Beaumont", "Lens", "Liévin", "Lillers",
  "Marquise", "Noyelles-sous-Lens", "Saint-Omer", "Saint-Pol-sur-Ternoise",
];

// Liste verticale qui dépasse — scrollbar visible (type="always").
export const CommunesAdherentes = () => (
  <ScrollArea type="always" className="rounded-md border" style={{ height: 190, width: 240 }}>
    <div style={{ padding: 14 }}>
      <h4 className="text-sm font-medium" style={{ marginBottom: 10 }}>
        Communes adhérentes
      </h4>
      {communes.map((commune) => (
        <div key={commune}>
          <div className="text-sm" style={{ padding: "6px 0" }}>
            {commune}
          </div>
          <Separator />
        </div>
      ))}
    </div>
  </ScrollArea>
);

// Défilement horizontal : rangée de thématiques plus large que le cadre.
export const ThematiquesHorizontales = () => (
  <ScrollArea type="always" className="rounded-md border" style={{ width: 320 }}>
    <div style={{ display: "flex", gap: 8, padding: 14, width: "max-content" }}>
      <Badge variant="secondary">Coworking</Badge>
      <Badge variant="secondary">Fablab</Badge>
      <Badge variant="secondary">Parentalité</Badge>
      <Badge variant="secondary">Inclusion numérique</Badge>
      <Badge variant="secondary">Économie circulaire</Badge>
      <Badge variant="secondary">Agriculture urbaine</Badge>
      <Badge variant="secondary">Culture</Badge>
      <Badge variant="secondary">Jeunesse</Badge>
    </div>
    <ScrollBar orientation="horizontal" />
  </ScrollArea>
);
