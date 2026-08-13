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

export const AacConfigSchema = z.object({
  /** ID du formulaire AAC (form parent `type:aap, aapType:aac`). */
  formId: z.string().min(1),
  /** Réglages de l'annuaire des communs. */
  directory: z
    .object({
      fields: AacDirectoryFieldsSchema.optional(),
    })
    .optional(),
});

export type AacConfig = z.infer<typeof AacConfigSchema>;
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
    /** Colonnes de la grille sur grand écran. */
    columns: z.number().int().min(1).max(4).default(3),
    /** Communs par page. Entre dans la clé de cache. */
    pageSize: z.number().int().min(1).max(100).default(12),
    /**
     * Activation des filtres. Un filtre activé mais dont la question n'a pas pu
     * être résolue est masqué — jamais rendu inerte.
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
  }),
});

export type AacDirectorySection = z.infer<typeof AacDirectorySectionSchema>;
export type AacDirectorySectionProps = AacDirectorySection["props"];
