import { Input, Label } from "site-forge";

// Champ texte de base — formulaire de contact d'un centre social.

export const ChampSimple = () => (
  <div className="max-w-sm space-y-2">
    <Label htmlFor="in-email">Adresse e-mail</Label>
    <Input id="in-email" type="email" placeholder="prenom.nom@exemple.fr" />
  </div>
);

export const Rempli = () => (
  <div className="max-w-sm space-y-2">
    <Label htmlFor="in-prenom">Prénom de l'enfant</Label>
    <Input id="in-prenom" defaultValue="Léonie" />
  </div>
);

export const Erreur = () => (
  <div className="max-w-sm space-y-2">
    <Label htmlFor="in-tel">Téléphone</Label>
    <Input id="in-tel" type="tel" defaultValue="06 12 34" aria-invalid />
    <p className="text-destructive text-sm">Numéro de téléphone incomplet.</p>
  </div>
);

export const Desactive = () => (
  <div className="max-w-sm space-y-2">
    <Label htmlFor="in-struct">Structure</Label>
    <Input id="in-struct" defaultValue="Centre social Les Tilleuls" disabled />
    <p className="text-muted-foreground text-sm">Renseigné automatiquement par votre compte.</p>
  </div>
);

export const TypesDeSaisie = () => (
  <div className="max-w-sm space-y-4">
    <div className="space-y-2">
      <Label htmlFor="in-date">Date de naissance</Label>
      <Input id="in-date" type="date" defaultValue="2018-03-14" />
    </div>
    <div className="space-y-2">
      <Label htmlFor="in-nb">Nombre de participants</Label>
      <Input id="in-nb" type="number" defaultValue={2} min={1} max={6} />
    </div>
  </div>
);
