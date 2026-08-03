import { Calendar } from "site-forge";
import { fr } from "react-day-picker/locale";

// Mois affiché et sélections FIGÉS (juillet 2026) : jamais de Date.now() dans
// les props → capture stable d'un jour à l'autre. Locale fr de react-day-picker
// (ré-export date-fns) pour des libellés français réalistes.

const moisAffiche = new Date(2026, 6, 1);

export const JourSelectionne = () => (
  <Calendar
    mode="single"
    month={moisAffiche}
    selected={new Date(2026, 6, 15)}
    onSelect={() => {}}
    locale={fr}
    className="rounded-md border shadow-sm"
  />
);

export const PlageDeDates = () => (
  <Calendar
    mode="range"
    month={moisAffiche}
    selected={{ from: new Date(2026, 6, 6), to: new Date(2026, 6, 10) }}
    onSelect={() => {}}
    locale={fr}
    className="rounded-md border shadow-sm"
  />
);

export const NavigationParListes = () => (
  <Calendar
    mode="single"
    month={moisAffiche}
    selected={new Date(2026, 6, 15)}
    onSelect={() => {}}
    locale={fr}
    captionLayout="dropdown"
    // Bornes explicites : sans startMonth/endMonth, le layout dropdown clampe
    // l'affichage hors du mois demandé (déc. 2024 constaté en capture).
    startMonth={new Date(2024, 0)}
    endMonth={new Date(2027, 11)}
    className="rounded-md border shadow-sm"
  />
);
