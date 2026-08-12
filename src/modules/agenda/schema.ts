import { z } from "zod";
import { LocalizedString } from "@/types/locale-schema";
import { MapConfSchema } from "@/modules/search/schema";

/** Onglets temporels de la liste agenda. */
export const AGENDA_TABS = ["ongoing", "upcoming", "past"] as const;

/**
 * Section `agenda` (config-driven) : expérience event d'un costum sur `searchEventsCostum`.
 * Deux vues complémentaires basculables : LISTE à onglets temporels (En cours / À venir / Passés,
 * mode calendrier now→fenêtre + mode liste paginé pour les passés) et GRILLE calendrier (grille mois
 * maison Tailwind/shadcn, refetch à la navigation). Filtres : type + texte (backend) et tags (client).
 */
export const AgendaSectionSchema = z.object({
  type: z.literal("agenda"),
  id: z.string().optional(),
  props: z.object({
    title: LocalizedString.optional(),
    description: LocalizedString.optional(),
    /**
     * En-tête avec lien « voir tous » — MÊME convention que `searchProStatic.customHeader`
     * (`title` prioritaire sur `title` ci-dessus ; `linkText`/`linkHref`/`linkIcon` pour un bloc
     * teaser → page complète, ex. home → `/evenements`).
     */
    customHeader: z
      .object({
        title: LocalizedString.optional(),
        linkText: LocalizedString.optional(),
        linkHref: z.string().optional(),
        linkIcon: z.string().optional(),
      })
      .optional(),
    /** Limite d'events par bucket (teaser home). Absent = tous (+ « charger plus » pour Passés). */
    limit: z.number().int().positive().optional(),
    /** Afficher le toggle Liste/Calendrier (false = teaser : vue figée à `defaultMode`). */
    showViewToggle: z.boolean().default(true),
    /** Afficher les onglets temporels (false = teaser : un seul bucket = `defaultTab`, sans onglets). */
    showTabs: z.boolean().default(true),
    /** Vue par défaut : liste à onglets temporels ou grille calendrier. */
    defaultMode: z.enum(["list", "calendar"]).default("list"),
    /** Activer la vue CARTE (toggle « Carte », réutilise SearchMap de search). */
    enableMap: z.boolean().default(false),
    /** Rendu de la vue carte : plein écran (`map`) ou liste+carte synchronisées (`split`, desktop ; mobile → map). */
    mapView: z.enum(["map", "split"]).default("map"),
    /** Config carte (marqueurs/popup/zoom) — MÊME schéma que searchProStatic.map. */
    map: MapConfSchema.optional(),
    /** Onglets affichés + onglet par défaut. */
    tabs: z.array(z.enum(AGENDA_TABS)).default(["upcoming", "ongoing", "past"]),
    defaultTab: z.enum(AGENDA_TABS).default("upcoming"),
    /** Fenêtre (mois) du fetch CALENDRIER now→futur pour À venir/En cours. */
    upcomingWindowMonths: z.number().int().positive().default(12),
    /**
     * Scope & filtres backend de `searchEventsCostum` — MÊME convention que `searchProStatic.baseParams`
     * (page /evenements). Champs repris : `sourceKey` (multi-sources ; vide → costum courant),
     * `indexStepList` (pagination liste), `fediverse`, `filters`, `locality`. Les autres clés (ex.
     * `defaultFields`/`defaultSortBy`/`defaultTypes`) sont tolérées (passthrough) mais ignorées :
     * searchEventsCostum force `searchType=["events"]` et trie par occurrence.
     */
    baseParams: z
      .object({
        sourceKey: z.array(z.string()).optional(),
        // Porte de VALIDATION : masque les événements en attente
        // (`preferences.toBeValidated.<slug>` / `source.toBeValidated.<slug>`). Même sémantique que
        // `searchProStatic.baseParams.costumSlug`. Sans elle, un événement proposé par un formulaire
        // costum injectant `toBeValidated` s'affiche publiquement dès sa création.
        costumSlug: z.string().optional(),
        indexStepList: z.number().int().positive().optional(),
        fediverse: z.boolean().optional(),
        filters: z.record(z.string(), z.unknown()).optional(),
        locality: z.record(z.string(), z.unknown()).optional(),
      })
      .passthrough()
      .optional(),
    /** Filtres activés. */
    filters: z.object({ type: z.boolean(), text: z.boolean(), tags: z.boolean() }).partial().optional(),
    /** Conteneur du détail au clic. */
    detailsMode: z.enum(["drawer", "dialog"]).default("drawer"),
    /** Colonnes de la grille de cartes (réutilise SearchListView). */
    columns: z.object({ sm: z.number(), md: z.number(), lg: z.number(), xl: z.number() }).partial().optional(),
    /**
     * Largeur du conteneur. ABSENT = `container` historique (plafond 1536 px aux
     * grands écrans) : c'est le rendu d'une PAGE agenda dédiée, où la section
     * occupe seule la page.
     *
     * À renseigner quand l'agenda est un TEASER posé parmi d'autres sections :
     * `container` ne s'aligne sur aucun des échelons `max-w-*` employés
     * ailleurs, et le teaser déborderait visiblement des sections voisines.
     * Mêmes valeurs que `data-observatory.maxWidth`.
     */
    maxWidth: z.enum(["4xl", "5xl", "6xl", "7xl", "8xl", "full"]).optional(),
    bg: z.enum(["default", "card", "muted", "primary", "secondary", "accent", "transparent"]).optional(),
  }),
});

export type AgendaSection = z.infer<typeof AgendaSectionSchema>;
export type AgendaSectionProps = AgendaSection["props"];
export type AgendaTab = (typeof AGENDA_TABS)[number];
