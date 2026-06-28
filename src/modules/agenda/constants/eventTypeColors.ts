import { EVENT_TYPES } from "@communecter/cocolight-api-client";

interface ColorDefinition { main: string; container: string; onContainer: string }
export interface AgendaCalendarType { colorName: string; lightColors: ColorDefinition; darkColors: ColorDefinition }

/** Palette cyclée (1 couleur par type d'event) pour la grille schedule-x. */
const PALETTE: { light: ColorDefinition; dark: ColorDefinition }[] = [
  { light: { main: "#3b82f6", container: "#dbeafe", onContainer: "#1e3a8a" }, dark: { main: "#93c5fd", container: "#1e3a8a", onContainer: "#dbeafe" } },
  { light: { main: "#ec4899", container: "#fce7f3", onContainer: "#831843" }, dark: { main: "#f9a8d4", container: "#831843", onContainer: "#fce7f3" } },
  { light: { main: "#10b981", container: "#d1fae5", onContainer: "#064e3b" }, dark: { main: "#6ee7b7", container: "#064e3b", onContainer: "#d1fae5" } },
  { light: { main: "#f59e0b", container: "#fef3c7", onContainer: "#78350f" }, dark: { main: "#fcd34d", container: "#78350f", onContainer: "#fef3c7" } },
  { light: { main: "#8b5cf6", container: "#ede9fe", onContainer: "#4c1d95" }, dark: { main: "#c4b5fd", container: "#4c1d95", onContainer: "#ede9fe" } },
  { light: { main: "#06b6d4", container: "#cffafe", onContainer: "#164e63" }, dark: { main: "#67e8f9", container: "#164e63", onContainer: "#cffafe" } },
  { light: { main: "#ef4444", container: "#fee2e2", onContainer: "#7f1d1d" }, dark: { main: "#fca5a5", container: "#7f1d1d", onContainer: "#fee2e2" } },
  { light: { main: "#64748b", container: "#e2e8f0", onContainer: "#1e293b" }, dark: { main: "#cbd5e1", container: "#1e293b", onContainer: "#e2e8f0" } },
];

/** `calendars` schedule-x : id (= type d'event) → couleurs. `calendarId` des events pointe ces clés. */
export const EVENT_CALENDARS: Record<string, AgendaCalendarType> = Object.fromEntries(
  [...EVENT_TYPES, "others"].map((t, i) => {
    const p = PALETTE[i % PALETTE.length];
    return [String(t), { colorName: String(t), lightColors: p.light, darkColors: p.dark }];
  }),
);
