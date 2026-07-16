import { Label, Switch } from "site-forge";

// Interrupteurs — préférences de notification d'un compte habitant.

export const PreferencesNotifications = () => (
  <div className="max-w-sm space-y-4">
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor="sw-agenda">Nouveaux événements de l'agenda</Label>
      <Switch id="sw-agenda" defaultChecked />
    </div>
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor="sw-actus">Actualités du quartier</Label>
      <Switch id="sw-actus" defaultChecked />
    </div>
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor="sw-messages">Messages privés par e-mail</Label>
      <Switch id="sw-messages" />
    </div>
  </div>
);

export const AvecDescription = () => (
  <div className="flex max-w-sm items-center justify-between gap-4 rounded-lg border p-4">
    <div className="space-y-0.5">
      <Label htmlFor="sw-public">Profil visible dans l'annuaire</Label>
      <p className="text-muted-foreground text-sm">
        Votre nom et vos activités apparaissent dans la recherche du réseau.
      </p>
    </div>
    <Switch id="sw-public" defaultChecked />
  </div>
);

export const Etats = () => (
  <div className="space-y-3">
    <div className="flex items-center gap-3">
      <Switch id="sw-off" />
      <Label htmlFor="sw-off">Inactif</Label>
    </div>
    <div className="flex items-center gap-3">
      <Switch id="sw-on" defaultChecked />
      <Label htmlFor="sw-on">Actif</Label>
    </div>
    <div className="group flex items-center gap-3" data-disabled="true">
      <Switch id="sw-dis" disabled />
      <Label htmlFor="sw-dis">Désactivé</Label>
    </div>
    <div className="group flex items-center gap-3" data-disabled="true">
      <Switch id="sw-dis-on" disabled defaultChecked />
      <Label htmlFor="sw-dis-on">Désactivé, actif</Label>
    </div>
  </div>
);
