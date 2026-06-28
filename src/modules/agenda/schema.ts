import { z } from "zod";
import { LocalizedString } from "@/types/locale-schema";

/** Onglets temporels de la liste agenda. */
export const AGENDA_TABS = ["ongoing", "upcoming", "past"] as const;

/**
 * Section `agenda` (config-driven) : expérience event d'un costum sur `searchEventsCostum`.
 * Deux vues complémentaires basculables : LISTE à onglets temporels (En cours / À venir / Passés,
 * mode calendrier now→fenêtre + mode liste paginé pour les passés) et GRILLE calendrier (schedule-x,
 * refetch à la navigation). Filtres : type + texte (backend) et tags (client).
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
    filters: z.object({ type: z.boolean(), text: z.boolean(), tags: z.boolean() }).partial().optional(),
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
