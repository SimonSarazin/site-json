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
export const AacConfigSchema = z.object({
  /** ID du formulaire AAC (form parent `type:aap, aapType:aac`). */
  formId: z.string().min(1),
});

export type AacConfig = z.infer<typeof AacConfigSchema>;

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
