import { DateTimePicker, Label, TimePicker } from "site-forge";

// Sélecteur date/heure — planification d'un événement de quartier. Le
// calendrier ouvert passe par un portal Radix (Popover) et déborderait de
// la cellule : on montre les états FERMÉS (placeholder, valeurs, clearable,
// désactivé) + la rangée TimePicker inline exportée par le même module.
// Dates FIXES pour des captures déterministes (format fr par défaut).

const dateAtelier = new Date(2026, 8, 12, 14, 30, 0); // 12 sept. 2026 14:30

export const Placeholder = () => (
  <div className="max-w-sm space-y-2">
    <Label>Date de début</Label>
    <DateTimePicker placeholder="Choisir une date et une heure" granularity="minute" />
  </div>
);

export const DateSeule = () => (
  <div className="max-w-sm space-y-2">
    <Label>Date de l'assemblée générale</Label>
    <DateTimePicker
      value={dateAtelier}
      granularity="day"
      displayFormat={{ hour24: "PPP" }}
    />
  </div>
);

export const DateEtHeure = () => (
  <div className="max-w-sm space-y-2">
    <Label>Début de l'atelier</Label>
    <DateTimePicker value={dateAtelier} granularity="minute" />
    <p className="text-muted-foreground text-sm">Heure locale (Europe/Paris).</p>
  </div>
);

export const Effacable = () => (
  <div className="max-w-sm space-y-2">
    <Label>Date de fin (facultative)</Label>
    <DateTimePicker value={new Date(2026, 8, 12, 17, 0, 0)} granularity="minute" clearable />
  </div>
);

export const SaisieHeure = () => (
  <div className="max-w-sm space-y-2">
    <Label>Heure de rendez-vous</Label>
    <TimePicker date={new Date(2026, 8, 12, 9, 45, 0)} hourCycle={24} granularity="minute" />
  </div>
);

export const Desactive = () => (
  <div className="max-w-sm space-y-2">
    <Label>Date de publication</Label>
    <DateTimePicker value={new Date(2026, 5, 30, 8, 0, 0)} granularity="minute" disabled />
    <p className="text-muted-foreground text-sm">Fixée par la modération.</p>
  </div>
);
