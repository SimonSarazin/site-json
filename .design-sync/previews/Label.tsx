import { Checkbox, Input, Label } from "site-forge";

// Étiquette de champ — associée par htmlFor, horizontale avec une case,
// mention obligatoire, et état désactivé propagé par le groupe.

export const AvecChamp = () => (
  <div className="max-w-sm space-y-2">
    <Label htmlFor="lb-ville">Commune</Label>
    <Input id="lb-ville" placeholder="Ex. : Saint-Denis" />
  </div>
);

export const AvecCase = () => (
  <div className="flex items-center gap-3">
    <Checkbox id="lb-benevole" defaultChecked />
    <Label htmlFor="lb-benevole">Je suis disponible comme bénévole le week-end</Label>
  </div>
);

export const ChampObligatoire = () => (
  <div className="max-w-sm space-y-2">
    <Label htmlFor="lb-email">
      Adresse e-mail <span className="text-destructive">*</span>
    </Label>
    <Input id="lb-email" type="email" placeholder="prenom.nom@exemple.fr" />
    <p className="text-muted-foreground text-sm">Obligatoire pour recevoir la confirmation d'inscription.</p>
  </div>
);

export const GroupeDesactive = () => (
  <div className="group max-w-sm space-y-2" data-disabled="true">
    <Label htmlFor="lb-ref">Référent de l'antenne</Label>
    <Input id="lb-ref" defaultValue="Nadia Belkacem" disabled />
  </div>
);
