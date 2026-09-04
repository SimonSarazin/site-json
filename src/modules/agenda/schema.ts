import { z } from "zod";
import { LocalizedString } from "@/types/locale-schema";
import { MapConfSchema } from "@/modules/search/schema";

/** Onglets temporels de la liste agenda. */
export const AGENDA_TABS = ["ongoing", "upcoming", "past"] as const;

/**
 * Section `agenda` (config-driven) : expérience event d'un costum sur `searchEventsCostum`.
 * Deux vues complémentaires basculables : LISTE à onglets temporels (En cours / À venir / Passés) et
 * GRILLE calendrier (grille mois maison Tailwind/shadcn, refetch à la navigation).
 * Filtres : type + texte (backend) et tags (client).
 *
 * La LISTE repose sur DEUX flux `searchEventsCostum` en mode LISTE, bornés et triés CÔTÉ SERVEUR
 * (`from`/`to`/`order`, legacy 2026-09-04 + miroir Node) : « prochains » (from = maintenant, ASC,
 * en cours en tête → onglets En cours / À venir) et « passés » (to = maintenant, DESC, sans récurrent
 * → onglet Passés), chacun paginé par `baseParams.indexStepList`. Une ligne par event, récurrents
 * compris (prochaine occurrence + fin calculées serveur). Un teaser `limit: 3` reçoit donc bien les
 * 3 prochains, quelle que soit la taille de page.
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
    /**
     * Plafond d'AFFICHAGE par bucket (teaser home). Absent = tous (+ « charger plus » par onglet).
     *
     * Le flux étant trié et borné côté serveur (les prochains d'abord), `limit: 3` ramène bien les
     * 3 prochains. En teaser « À venir » (`showTabs: false`), les événements EN COURS sont comptés
     * parmi les prochains (en tête) — « les 3 prochaines réunions » inclut celle qui a lieu maintenant.
     */
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
    /**
     * Borne haute (en mois) du bucket « À venir » : filtre CLIENT appliqué au flux liste — un event
     * au-delà est chargé puis écarté. (Ce n'était un fetch calendrier borné que jusqu'au passage au
     * flux liste unique, qui évitait une ligne par OCCURRENCE des récurrents.)
     */
    upcomingWindowMonths: z.number().int().positive().default(12),
    /**
     * Scope & filtres backend de `searchEventsCostum` — MÊME convention que `searchProStatic.baseParams`
     * (page /evenements). Champs repris : `sourceKey` (multi-sources ; vide → costum courant),
     * `notSourceKey` (désactive le périmètre costum), `costumSlug` (porte de validation),
     * `indexStepList` (pagination liste), `fediverse`, `filters`, `locality`. Les autres clés (ex.
     * `defaultFields`/`defaultSortBy`/`defaultTypes`) sont tolérées (passthrough) mais ignorées :
     * searchEventsCostum force `searchType=["events"]` et trie par occurrence.
     */
    baseParams: z
      .object({
        sourceKey: z.array(z.string()).optional(),
        notSourceKey: z.boolean().optional(),
        // Porte de VALIDATION : masque les événements en attente
        // (`preferences.toBeValidated.<slug>` / `source.toBeValidated.<slug>`). Même sémantique que
        // `searchProStatic.baseParams.costumSlug`. Sans elle, un événement proposé par un formulaire
        // costum injectant `toBeValidated` s'affiche publiquement dès sa création.
        // ⚠ `notSourceKey` la DÉSARME (pas de costum de scope → pas de slug à indexer) : les deux
        // clés ensemble n'ont donc de sens que si l'on veut la porte, et il faut alors renoncer à
        // `notSourceKey`. Cf. `applyValidationGate`.
        costumSlug: z.string().optional(),
        /**
         * Taille de page de CHAQUE flux LISTE (`searchEventsCostum` borné/trié serveur : prochains ASC,
         * passés DESC). Défaut 20 (`AGENDA_DEFAULT_INDEX_STEP`). Sur un teaser : ≥ `limit` suffit.
         */
        indexStepList: z.number().int().positive().optional(),
        /**
         * Inclure les événements RÉCURRENTS (ceux qui portent des créneaux `openingHours` au lieu
         * d'une date). ABSENT = inclus — le défaut du serveur, et le comportement historique.
         *
         * `false` pour un site dont l'agenda ne parle que de dates uniques : une série hebdomadaire
         * y occupe une ligne permanente (« Chaque mardi ») qui ne descend jamais dans la liste, et
         * noie les rendez-vous ponctuels. S'applique aux DEUX modes — flux liste (la requête des
         * récurrents est sautée) et grille calendrier (les clauses `openingHours.dayOfWeek` ne sont
         * pas posées).
         *
         * ⚠ Sans effet sur l'onglet « Passés », qui exclut les récurrents en toutes circonstances :
         * une série ne renvoie que sa PROCHAINE occurrence, jamais ses occurrences révolues — l'y
         * laisser afficherait un événement à venir dans l'onglet du passé (cf. `pastBounds`).
         *
         * ⚠ La config n'est jamais parsée par Zod au runtime : ne pas compter sur un `.default()`
         * ici, le repli « absent = inclus » vit dans `fromBaseParams` (clé simplement non émise).
         */
        recurrency: z.boolean().optional(),
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
