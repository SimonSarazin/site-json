import { z } from "zod";
import { LocalizedString } from "@/types/locale-schema";

/** Onglets temporels de la liste agenda. */
export const AGENDA_TABS = ["ongoing", "upcoming", "past"] as const;

/**
 * Section `agenda` (config-driven) : expérience event d'un costum. v1 = vue LISTE à onglets temporels
 * (En cours / À venir / Passés) sur `searchEventsCostum`. La grille calendrier (vue "calendar") s'ajoute
 * dans une itération suivante (prop `defaultMode`/`calendar` réservée).
 */
export const AgendaSectionSchema = z.object({
  type: z.literal("agenda"),
  id: z.string().optional(),
  props: z.object({
    title: LocalizedString.optional(),
    description: LocalizedString.optional(),
    /** Vue par défaut : liste à onglets temporels ou grille calendrier. */
    defaultMode: z.enum(["list", "calendar"]).default("list"),
    /** Onglets affichés + onglet par défaut. */
    tabs: z.array(z.enum(AGENDA_TABS)).default(["upcoming", "ongoing", "past"]),
    defaultTab: z.enum(AGENDA_TABS).default("upcoming"),
    /** Fenêtre (mois) du fetch CALENDRIER now→futur pour À venir/En cours. */
    upcomingWindowMonths: z.number().int().positive().default(12),
    /** Filtres activés. */
    filters: z.object({ type: z.boolean(), text: z.boolean() }).partial().optional(),
    /** Conteneur du détail au clic. */
    detailsMode: z.enum(["drawer", "dialog"]).default("drawer"),
    /** Colonnes de la grille de cartes (réutilise SearchListView). */
    columns: z.object({ sm: z.number(), md: z.number(), lg: z.number(), xl: z.number() }).partial().optional(),
    bg: z.enum(["default", "card", "muted", "primary", "secondary", "accent", "transparent"]).optional(),
  }),
});

export type AgendaSection = z.infer<typeof AgendaSectionSchema>;
export type AgendaSectionProps = AgendaSection["props"];
export type AgendaTab = (typeof AGENDA_TABS)[number];
