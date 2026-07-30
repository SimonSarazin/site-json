import {
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "site-forge";

// Liste déroulante (Radix Select) — le menu ouvert passe par un portal et
// déborde de la cellule : on montre l'état FERMÉ (placeholder / valeur
// choisie / tailles / erreur / désactivé). Les items restent définis dans
// SelectContent pour une composition fidèle.

const quartiers = (
  <SelectContent>
    <SelectGroup>
      <SelectLabel>Quartiers nord</SelectLabel>
      <SelectItem value="tilleuls">Les Tilleuls</SelectItem>
      <SelectItem value="grand-clos">Grand Clos</SelectItem>
    </SelectGroup>
    <SelectGroup>
      <SelectLabel>Quartiers sud</SelectLabel>
      <SelectItem value="port">Le Port</SelectItem>
      <SelectItem value="madeleine">La Madeleine</SelectItem>
    </SelectGroup>
  </SelectContent>
);

export const AvecPlaceholder = () => (
  <div className="max-w-sm space-y-2">
    <Label>Quartier</Label>
    <Select>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Choisir un quartier" />
      </SelectTrigger>
      {quartiers}
    </Select>
  </div>
);

export const ValeurChoisie = () => (
  <div className="max-w-sm space-y-2">
    <Label>Quartier</Label>
    <Select defaultValue="madeleine">
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      {quartiers}
    </Select>
  </div>
);

export const PetiteTaille = () => (
  <div className="flex items-center gap-3">
    <Label>Trier par</Label>
    <Select defaultValue="date">
      <SelectTrigger size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="date">Date</SelectItem>
        <SelectItem value="distance">Distance</SelectItem>
        <SelectItem value="alpha">Ordre alphabétique</SelectItem>
      </SelectContent>
    </Select>
  </div>
);

export const Erreur = () => (
  <div className="max-w-sm space-y-2">
    <Label>
      Type de structure <span className="text-destructive">*</span>
    </Label>
    <Select>
      <SelectTrigger className="w-full" aria-invalid>
        <SelectValue placeholder="Sélectionner…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="asso">Association</SelectItem>
        <SelectItem value="collectif">Collectif d'habitants</SelectItem>
        <SelectItem value="commune">Commune</SelectItem>
      </SelectContent>
    </Select>
    <p className="text-destructive text-sm">Ce champ est obligatoire.</p>
  </div>
);

export const Desactive = () => (
  <div className="max-w-sm space-y-2">
    <Label>Antenne de rattachement</Label>
    <Select defaultValue="centre" disabled>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="centre">Antenne du centre-ville</SelectItem>
      </SelectContent>
    </Select>
    <p className="text-muted-foreground text-sm">Déterminée par votre adresse.</p>
  </div>
);
