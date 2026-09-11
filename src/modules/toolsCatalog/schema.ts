import { z } from "zod";
import { LocalizedString } from "@/types/locale-schema";
import { templateYieldsCommunId } from "./utils/communLink";

/**
 * Section `toolsCatalog` : catalogue générique d'outils d'usage (paginé +
 * recherchable côté serveur). Piloté par la config — les options couvrent les
 * variantes des 2 vues legacy (titre, toggle open-source, grille/liste, compteur…).
 */
export const ToolsCatalogSectionSchema = z.object({
  type: z.literal("toolsCatalog"),
  id: z.string().optional(),
  props: z.object({
    // ── Source de données (requis) ────────────────────────────────────────
    /** Id du form de réponses (answers.form). */
    formId: z.string(),
    /** Champ `id` du form dont les `inputs` = catégories d'usage. */
    step: z.string(),
    /** Dot-path du lieu/CAE dans la réponse (ne compte que les réponses liées). */
    finderPath: z.string(),

    // ── Affichage ─────────────────────────────────────────────────────────
    title: LocalizedString.optional(),
    description: LocalizedString.optional(),
    searchPlaceholder: LocalizedString.optional(),
    showSearch: z.boolean().default(true),
    showResultCount: z.boolean().default(true),
    showOpenSourceToggle: z.boolean().default(false),
    showCategoryFilter: z.boolean().default(true),
    showUsageFilter: z.boolean().default(false),
    defaultView: z.enum(["grid", "list"]).default("grid"),
    /** Densité de la grille (défaut sm:2 lg:3 xl:3, md non défini). */
    columns: z.object({ sm: z.number(), md: z.number(), lg: z.number(), xl: z.number() }).partial().optional(),
    /** Taille de page serveur (défaut 24). */
    indexStep: z.number().optional(),

    // ── Bloc « commun » lié (fiche AAP à côté de l'outil) ──────────────────
    /**
     * Affiche le bloc « Informations liées au commun » dans la modale détail
     * pour les outils qui référencent un commun (item.communId non vide).
     */
    showCommunInfo: z.boolean().default(false),
    /**
     * Id du form AAP des communs (gate anti-IDOR : la fiche commun doit
     * appartenir à ce form). Recommandé quand `showCommunInfo` est actif.
     */
    communFormId: z.string().optional(),

    /**
     * Bouton « Répondez au questionnaire » en tête de section → `/coform/{formId}/place`
     * (liste des lieux de l'utilisateur, puis réponse partagée du lieu). Affiché aux
     * seuls utilisateurs connectés, comme le bouton legacy.
     */
    showAnswerButton: z.boolean().default(false),
    /** Libellé du bouton (clé i18n ou LocalizedString) ; défaut = `answerButton`. */
    answerButtonLabel: LocalizedString.optional(),

    /**
     * Édition de l'enrichissement d'un outil (lien, commun, description, open
     * source, image) depuis la modale. Le bouton n'apparaît qu'aux ADMINS DU
     * COSTUM, et le serveur revérifie ce droit (`Authorisation::isInterfaceAdmin`).
     */
    enableEnrichmentEditing: z.boolean().default(false),
    /**
     * Gabarit d'URL du commun (`{communId}` substitué), utilisé quand on rattache un
     * outil qui n'avait pas encore de lien de commun. Quand il en a déjà un, sa BASE
     * est réutilisée : le domaine dépend du costum (lescommuns.tiers-lieux.org,
     * communs.les-cae.coop…).
     *
     * Sans valeur, le rattachement d'un outil dépourvu de lien n'écrit rien plutôt
     * que d'écrire une URL sans domaine. PAS de `.default()` : la config n'est pas
     * `parse`-ée au runtime (les props arrivent brutes du JSON), un défaut zod ne
     * s'appliquerait donc jamais — et un domaine d'un costum précis n'a de toute
     * façon rien à faire dans le schéma d'un module générique.
     *
     * ⚠️ Le gabarit doit produire un lien que le SERVEUR sait relire, sinon le
     * rattachement s'enregistre puis disparaît (`communId: ""` au retour, select sur
     * « Aucun commun », bloc « Informations liées au commun » jamais rendu) — sans la
     * moindre erreur nulle part. Deux formes sont reconnues, cf. `utils/communLink` :
     * l'ancre legacy `#detail-un-commun.communId.{communId}` et la route de fiche
     * site-json `…/commun/{communId}`.
     *
     * Le refine ne cherche pas un motif : il SUBSTITUE une communId factice et relit
     * le résultat avec le même code que le serveur. Le contrôle reste donc exact si
     * les formes acceptées évoluent. Seuls les gates parsent (`config:validate`,
     * préflight) — c'est là que ça doit casser, pas en silence dans la base.
     */
    communUrlTemplate: z
      .string()
      .refine(templateYieldsCommunId, {
        message:
          "communUrlTemplate doit produire un lien relisible par le serveur : soit une route « …/commun/{communId} », soit l'ancre legacy « #detail-un-commun.communId.{communId} ».",
      })
      .optional(),

    // ── Habillage section ─────────────────────────────────────────────────
    bg: z.string().optional(),
    /** Défaut `container` = largeur du contenu topbar (un config sans width s'aligne dessus). */
    width: z.enum(["container", "full"]).default("container"),
  }),
});

export type ToolsCatalogSection = z.infer<typeof ToolsCatalogSectionSchema>;
export type ToolsCatalogSectionProps = z.infer<typeof ToolsCatalogSectionSchema>["props"];
