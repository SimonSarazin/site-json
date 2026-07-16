import { Checkbox, Label } from "site-forge";

// Cases à cocher — inscription à un atelier parent-enfant.

export const ChoixDAteliers = () => (
  <fieldset className="max-w-sm space-y-3">
    <legend className="mb-1 text-sm font-medium">Ateliers souhaités</legend>
    <div className="flex items-center gap-3">
      <Checkbox id="cb-cuisine" defaultChecked />
      <Label htmlFor="cb-cuisine">Cuisine de saison (mercredi 10h)</Label>
    </div>
    <div className="flex items-center gap-3">
      <Checkbox id="cb-jardin" defaultChecked />
      <Label htmlFor="cb-jardin">Jardin partagé (samedi 9h30)</Label>
    </div>
    <div className="flex items-center gap-3">
      <Checkbox id="cb-theatre" />
      <Label htmlFor="cb-theatre">Théâtre parent-enfant (vendredi 17h)</Label>
    </div>
  </fieldset>
);

export const AvecDescription = () => (
  <div className="flex max-w-sm items-start gap-3">
    <Checkbox id="cb-rgpd" className="mt-0.5" />
    <div className="space-y-1">
      <Label htmlFor="cb-rgpd">J'accepte d'être recontacté·e</Label>
      <p className="text-muted-foreground text-sm">
        Uniquement pour le suivi de votre inscription. Vos données ne sont jamais partagées.
      </p>
    </div>
  </div>
);

export const Etats = () => (
  <div className="space-y-3">
    <div className="flex items-center gap-3">
      <Checkbox id="cb-off" />
      <Label htmlFor="cb-off">Non cochée</Label>
    </div>
    <div className="flex items-center gap-3">
      <Checkbox id="cb-on" defaultChecked />
      <Label htmlFor="cb-on">Cochée</Label>
    </div>
    <div className="group flex items-center gap-3" data-disabled="true">
      <Checkbox id="cb-dis" disabled />
      <Label htmlFor="cb-dis">Désactivée</Label>
    </div>
    <div className="group flex items-center gap-3" data-disabled="true">
      <Checkbox id="cb-dis-on" disabled defaultChecked />
      <Label htmlFor="cb-dis-on">Désactivée et cochée</Label>
    </div>
  </div>
);

export const Erreur = () => (
  <div className="max-w-sm space-y-2">
    <div className="flex items-center gap-3">
      <Checkbox id="cb-reglement" aria-invalid />
      <Label htmlFor="cb-reglement">J'ai lu le règlement intérieur</Label>
    </div>
    <p className="text-destructive text-sm">Vous devez accepter le règlement pour valider l'inscription.</p>
  </div>
);
