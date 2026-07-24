import { Label, RadioGroup, RadioGroupItem } from "site-forge";

// Boutons radio — choix d'un créneau et d'un mode de participation.

export const CreneauAtelier = () => (
  <div className="max-w-sm space-y-3">
    <p className="text-sm font-medium">Créneau souhaité</p>
    <RadioGroup defaultValue="mer-14">
      <div className="flex items-center gap-3">
        <RadioGroupItem value="mer-10" id="rg-mer10" />
        <Label htmlFor="rg-mer10">Mercredi 10h — 12h</Label>
      </div>
      <div className="flex items-center gap-3">
        <RadioGroupItem value="mer-14" id="rg-mer14" />
        <Label htmlFor="rg-mer14">Mercredi 14h — 16h</Label>
      </div>
      <div className="flex items-center gap-3">
        <RadioGroupItem value="sam-10" id="rg-sam10" />
        <Label htmlFor="rg-sam10">Samedi 10h — 12h</Label>
      </div>
    </RadioGroup>
  </div>
);

export const AvecDescriptions = () => (
  <RadioGroup defaultValue="presentiel" className="max-w-sm">
    <div className="flex items-start gap-3 rounded-lg border p-4">
      <RadioGroupItem value="presentiel" id="rg-pres" className="mt-0.5" />
      <div className="space-y-1">
        <Label htmlFor="rg-pres">En présentiel</Label>
        <p className="text-muted-foreground text-sm">Au centre social Les Tilleuls, salle polyvalente.</p>
      </div>
    </div>
    <div className="flex items-start gap-3 rounded-lg border p-4">
      <RadioGroupItem value="visio" id="rg-visio" className="mt-0.5" />
      <div className="space-y-1">
        <Label htmlFor="rg-visio">En visioconférence</Label>
        <p className="text-muted-foreground text-sm">Le lien vous sera envoyé la veille de la réunion.</p>
      </div>
    </div>
  </RadioGroup>
);

export const AvecOptionIndisponible = () => (
  <div className="max-w-sm space-y-3">
    <p className="text-sm font-medium">Point de retrait du panier solidaire</p>
    <RadioGroup defaultValue="marche">
      <div className="flex items-center gap-3">
        <RadioGroupItem value="marche" id="rg-marche" />
        <Label htmlFor="rg-marche">Marché couvert (jeudi)</Label>
      </div>
      <div className="group flex items-center gap-3" data-disabled="true">
        <RadioGroupItem value="mairie" id="rg-mairie" disabled />
        <Label htmlFor="rg-mairie">Mairie annexe — complet</Label>
      </div>
      <div className="flex items-center gap-3">
        <RadioGroupItem value="epicerie" id="rg-epicerie" />
        <Label htmlFor="rg-epicerie">Épicerie associative (samedi)</Label>
      </div>
    </RadioGroup>
  </div>
);

export const Erreur = () => (
  <div className="max-w-sm space-y-3">
    <p className="text-sm font-medium">
      Tranche d'âge de l'enfant <span className="text-destructive">*</span>
    </p>
    <RadioGroup>
      <div className="flex items-center gap-3">
        <RadioGroupItem value="3-5" id="rg-35" aria-invalid />
        <Label htmlFor="rg-35">3 — 5 ans</Label>
      </div>
      <div className="flex items-center gap-3">
        <RadioGroupItem value="6-8" id="rg-68" aria-invalid />
        <Label htmlFor="rg-68">6 — 8 ans</Label>
      </div>
    </RadioGroup>
    <p className="text-destructive text-sm">Sélectionnez une tranche d'âge.</p>
  </div>
);
