import { z } from "zod";
import { LocalizedString } from "@/types/locale-schema";

/**
 * Bloc de config AAC AU NIVEAU DU SITE (`config.aac`) — même patron que
 * `config.ampli`, mais **SINGULIER : un seul AAC par site**.
 *
 * Le site déclare simplement SON formulaire (form parent `type:aap,
 * aapType:aac`). La section `aac` et la route `/aac` le lisent depuis ici →
 * source de vérité UNIQUE (pas de formId dupliqué dans les props de section).
 */
/**
 * Quel CHAMP du document porte chaque rôle de la carte d'annuaire.
 *
 * Deux formes, toutes deux lues par `parseFieldPath` :
 *
 *  - `answers.<étape>.<id>` — une réponse au formulaire. L'ÉTAPE fait partie du
 *    chemin : un form AAP en compte 4 ou 5, l'id seul n'en désigne aucune, et
 *    une question peut vivre ailleurs que sur l'étape attendue pour son rôle.
 *    C'est aussi la forme qu'écrit `form.mapping` en base ;
 *  - `<id>` sans point — un champ de la RACINE du document, c'est-à-dire l'un
 *    de ceux que le backend pré-calcule (`name`, `descriptionStr`, `tags`,
 *    `image`, `funds`…). Il n'appartient à aucune étape, et il n'est pas
 *    interrogeable côté serveur (calculé après la requête).
 *
 * Volontairement PAS de contrainte de forme ici : la valeur est une donnée
 * propre à un formulaire, et une regex trop étroite refuserait les champs
 * racine. Une valeur illisible est ignorée au runtime (retour au scan), pas
 * appliquée de travers.
 *
 * Facultatif — sans lui, `resolveAacCardFields` déduit par type et par libellé.
 * Pour lire les questions d'un form et leurs libellés :
 * `POST <backend>/survey/coform/getformbyid` avec `parentFormId=<formId>` (sans
 * auth) → `data.inputs.<étape>.inputs`.
 */
export const AacDirectoryFieldsSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.string().optional(),
  maturity: z.string().optional(),
  image: z.string().optional(),
  depense: z.string().optional(),
  choose: z.string().optional(),
  /**
   * Où compter les MEMBRES du commun — un chemin racine, presque toujours hors
   * de `answers`.
   *
   * Le vivier dépend de la PLATEFORME, pas du formulaire : `links.cae` sur la
   * fédération des CAE, `links.tls` sur les communs des tiers-lieux. Un même
   * commun peut être porté par deux AAC, avec des chiffres différents de part
   * et d'autre — d'où un chemin LIBRE, que rien n'oblige à passer par `links`.
   *
   * Non renseigné ⇒ repli sur le `user_count` du backend, qui compte en réalité
   * `links.contributors` : un tout autre ensemble.
   */
  users: z.string().optional(),
});

/**
 * Un bloc de prose de la FICHE d'un commun : une question de l'appel, rendue en
 * section avec son ancre et son entrée de sommaire.
 *
 * Les blocs sont DÉCLARÉS, pas devinés : la fiche n'a pas d'équivalent du `scan`
 * de l'annuaire, parce qu'aucune heuristique ne peut dire quelles questions d'un
 * appel méritent une section ni dans quel ordre. Sans déclaration, la fiche ne
 * rend aucun bloc de prose — ce qui est préférable à sept blocs vides.
 */
export const AacDetailSectionSchema = z.object({
  /** Ancre DOM et cible du sommaire. Doit être unique dans la liste. */
  id: z.string().min(1),
  /**
   * Titre du bloc. Omis ⇒ le LIBELLÉ de la question elle-même, ce qui fait porter
   * l'intitulé par l'appel plutôt que par une traduction générique.
   */
  title: LocalizedString.optional(),
  /** Sur-titre optionnel, au-dessus du titre. */
  kicker: LocalizedString.optional(),
  /** Nom d'icône lucide. Inconnu ou omis ⇒ icône par défaut. */
  icon: z.string().optional(),
  /** MÊME grammaire que `directory.fields` — cf. `AacDirectoryFieldsSchema`. */
  field: z.string().min(1),
});

/** Réglages propres à la FICHE d'un commun (`/aac/commun/:answerId`). */
export const AacDetailSchema = z.object({
  /**
   * Où vivent les images de la galerie : le `subKey` que porte chaque document
   * joint (`answers.<étape>.<id>` côté document ⇒ `<étape>.<id>` en subKey).
   * Omis ⇒ pas de galerie.
   */
  gallery: z.string().optional(),
  /** Les blocs de prose, DANS L'ORDRE d'affichage. */
  sections: z.array(AacDetailSectionSchema).optional(),
});

export const AacConfigSchema = z.object({
  /** ID du formulaire AAC (form parent `type:aap, aapType:aac`). */
  formId: z.string().min(1),
  /** Réglages de l'annuaire des communs. */
  directory: z
    .object({
      fields: AacDirectoryFieldsSchema.optional(),
    })
    .optional(),
  /** Réglages de la fiche d'un commun. */
  detail: AacDetailSchema.optional(),
});

export type AacConfig = z.infer<typeof AacConfigSchema>;
export type AacDetailConfig = z.infer<typeof AacDetailSchema>;
export type AacDetailSectionConfig = z.infer<typeof AacDetailSectionSchema>;
export type AacDirectoryFieldsConfig = z.infer<typeof AacDirectoryFieldsSchema>;

/**
 * Schéma Zod de la section `aac`.
 *
 * ⚠️ Le `formId` n'est PAS ici : il vient de `config.aac.formId` (un seul AAC
 * par site). Les props ne portent que la présentation.
 *
 * Forme imposée par la `discriminatedUnion("type")` de `@/types/site-schema` :
 * `{ type: z.literal(...), id?: string, props: z.object({...}) }`.
 */
export const AacSectionSchema = z.object({
  type: z.literal("aac"),
  id: z.string().optional(),
  props: z.object({
    title: LocalizedString.optional(),
    className: z.string().optional(),
  }),
});

export type AacSection = z.infer<typeof AacSectionSchema>;
export type AacSectionProps = AacSection["props"];

/**
 * Schéma Zod de la section `aac-directory` — l'annuaire des communs.
 *
 * Comme pour `aac`, le `formId` vient de `config.aac.formId`. Les props ne
 * portent que la présentation et le paramétrage d'affichage : tout ce qui
 * relève du formulaire (libellés et options des filtres) est DÉRIVÉ du form.
 */
export const AacDirectorySectionSchema = z.object({
  type: z.literal("aac-directory"),
  id: z.string().optional(),
  props: z.object({
    title: LocalizedString.optional(),
    description: LocalizedString.optional(),
    className: z.string().optional(),
    /**
     * Mode d'affichage INITIAL. Le visiteur peut basculer à tout moment via le
     * sélecteur posé à côté du compteur de résultats ; cette valeur ne fait que
     * choisir le point de départ.
     *
     *  - `grid` — la carte de commun, riche : image, description, tags, budget,
     *    barre de collecte. C'est la vue de découverte ;
     *  - `list` — une ligne par commun : vignette, titre, usages. C'est la vue
     *    de comparaison, celle qui tient une trentaine de communs à l'écran.
     */
    display: z.enum(["grid", "list"]).default("grid"),
    /** Colonnes de la grille sur grand écran. Sans effet en mode `list`. */
    columns: z.number().int().min(1).max(4).default(3),
    /** Communs par page. Entre dans la clé de cache. */
    pageSize: z.number().int().min(1).max(100).default(12),
    /**
     * Activation des filtres. Un filtre activé mais dont la question n'a pas pu
     * être résolue est masqué — jamais rendu inerte.
     *
     * Un bloc PARTIEL veut dire « je change ceux-là, le reste par défaut » :
     * `{ "search": false }` n'éteint que la recherche. Les `.default()` ci-dessous
     * ne s'appliquent pas à l'exécution (la config n'est jamais parsée par Zod) :
     * c'est `resolveDirectoryFilters` (`lib/directoryFilters.ts`) qui fusionne,
     * clé par clé, et qui doit rester aligné sur ces défauts — un test le vérifie.
     */
    filters: z
      .object({
        search: z.boolean().default(true),
        /** « Filtrer par besoins » — usage catégorisé, deux niveaux. */
        usage: z.boolean().default(true),
        tags: z.boolean().default(true),
        /** La question « Utilisable » du formulaire. */
        maturity: z.boolean().default(true),
        /** « Trier par ». */
        sort: z.boolean().default(true),
      })
      .default({ search: true, usage: true, tags: true, maturity: true, sort: true }),
    /** Message quand aucun commun ne correspond. Défaut : i18n `directory.empty`. */
    emptyText: LocalizedString.optional(),
    /**
     * CTA « Je dépose un commun », sur la ligne de titre.
     *
     * Le formulaire ouvert est celui de `config.aac.formId` — comme le reste de
     * la section, aucun `formId` ne transite par les props. Seule l'ÉTAPE de
     * dépôt est résolue (cf. `resolveAacDepositStepKey`) : les suivantes sont
     * l'évaluation, le financement et le suivi, réservées à des rôles.
     */
    showDepositButton: z.boolean().default(true),
    /** Libellé du CTA. Défaut : i18n `directory.deposit.cta`. */
    depositButtonLabel: LocalizedString.optional(),
    /**
     * `full` — l'annuaire complet : colonne de filtres, compteur de résultats,
     * bascule grille/liste, défilement infini. C'est la page dédiée.
     *
     * `preview` — un APERÇU pour une page d'accueil : les mêmes cartes, bornées
     * à `pageSize`, sans filtres ni compteur ni défilement, et suivies d'un
     * lien vers l'annuaire. Volontairement une variante de CETTE section et non
     * une section sœur : la carte, la résolution des champs et la restriction de
     * visibilité doivent rester les mêmes des deux côtés.
     */
    variant: z.enum(["full", "preview"]).default("full"),
    /**
     * Le lien « voir tout » de la variante `preview` — sans lui, l'aperçu est
     * un cul-de-sac. Ignoré en `full`.
     */
    moreLink: z
      .object({
        href: z.string().min(1),
        /** Défaut : i18n `directory.more`. */
        label: LocalizedString.optional(),
      })
      .optional(),
  }),
});

export type AacDirectorySection = z.infer<typeof AacDirectorySectionSchema>;
export type AacDirectorySectionProps = AacDirectorySection["props"];

/** Grille de cartes ou liste de lignes — dérivé du schéma, jamais redéclaré. */
export type AacDisplayMode = AacDirectorySectionProps["display"];
/** Annuaire complet ou aperçu — dérivé du schéma, jamais redéclaré. */
export type AacDirectoryVariant = AacDirectorySectionProps["variant"];

/**
 * Schéma Zod de la section `aac-highlight` — une bande d'appel à l'action,
 * avec son chiffre.
 *
 * C'est le bloc récurrent de la page d'accueil d'un AAC : un titre, un texte,
 * un bouton, et un médaillon qui dit combien de communs ont été déposés. Le
 * chiffre est COMPTÉ (mode `countonly` de l'endpoint), pas écrit dans la
 * config : un nombre saisi à la main est faux dès le lendemain.
 */
export const AacHighlightSectionSchema = z.object({
  type: z.literal("aac-highlight"),
  id: z.string().optional(),
  props: z.object({
    title: LocalizedString,
    description: LocalizedString.optional(),
    className: z.string().optional(),
    /**
     * `primary` — bande pleine couleur, celle qui rythme la page ;
     * `muted` — fond discret, pour deux bandes qui se suivent.
     */
    tone: z.enum(["primary", "muted"]).default("primary"),
    /** Le bouton de la bande. Omis ⇒ bande purement informative. */
    cta: z
      .object({
        label: LocalizedString,
        href: z.string().min(1),
      })
      .optional(),
    /**
     * Le médaillon chiffré. Omis ⇒ pas de médaillon.
     *
     * `source` n'a qu'une valeur aujourd'hui : `communs`, le cardinal de la
     * population visible de `config.aac.formId`. C'est une énumération et non un
     * booléen pour que d'autres compteurs (réponses à un autre formulaire,
     * financements) s'y ajoutent sans changer la forme de la config.
     */
    count: z
      .object({
        source: z.literal("communs"),
        /** Légende sous le chiffre. Défaut : i18n `highlight.communs`. */
        label: LocalizedString.optional(),
      })
      .optional(),
  }),
});

export type AacHighlightSection = z.infer<typeof AacHighlightSectionSchema>;
export type AacHighlightSectionProps = AacHighlightSection["props"];
