import { z } from "zod";

/**
 * Schemas Zod pour les sections JSON du module cagnotte.
 *
 * 5 sections exposées :
 *  - `actions` : liste détaillée des actions par milestone
 *  - `finance` : liste détaillée des milestones avec progression financière
 *  - `actions-summary` : carte synthèse actions (sidebar)
 *  - `finance-summary` : carte synthèse finance (sidebar)
 *  - `cagnotte-layout` : section conteneur (rend `<CagnotteProvider>` + grid 2 colonnes)
 *
 * Toutes les sections sont enregistrées dans `src/components/sections/SectionRenderer.tsx`
 * et intégrées à l'union `Section` de `src/types/site-schema.ts` (import depuis ce module).
 */

/**
 * Champs communs aux 4 sections data-driven (`actions`, `finance`, `actions-summary`,
 * `finance-summary`) — toutes pointent sur un projet et limitent le nombre d'items.
 * Centralisé pour éviter la duplication des défauts (`maxItems: 10`) entre sections.
 */
export const CagnotteBaseSectionPropsSchema = z.object({
  idProjet: z.string().optional(),
  maxItems: z.number().optional().default(10),
});

//──────────────── Actions Section (Milestones/Tasks)
export const ActionsSectionSchema = z.object({
  type: z.literal("actions"),
  id: z.string().optional(),
  props: CagnotteBaseSectionPropsSchema.extend({
    showStatus: z.boolean().optional().default(true),
    showProgress: z.boolean().optional().default(true),
    showDates: z.boolean().optional().default(true),
    layout: z.enum(["list", "grid", "timeline"]).optional().default("list"),
  }),
});

export type ActionsSection = z.infer<typeof ActionsSectionSchema>;
export type ActionsSectionProps = z.infer<typeof ActionsSectionSchema>["props"];

//──────────────── Finance Section (Funding/Cagnotte)
export const FinanceSectionSchema = z.object({
  type: z.literal("finance"),
  id: z.string().optional(),
  props: CagnotteBaseSectionPropsSchema.extend({
    showProgress: z.boolean().optional().default(true),
    showFundingGoal: z.boolean().optional().default(true),
    showContributors: z.boolean().optional().default(true),
    showTimeline: z.boolean().optional().default(false),
    layout: z.enum(["cards", "list", "compact"]).optional().default("cards"),
  }),
});

export type FinanceSection = z.infer<typeof FinanceSectionSchema>;
export type FinanceSectionProps = z.infer<typeof FinanceSectionSchema>["props"];

//──────────────── Actions Summary Section (Sidebar synthesis/charts)
export const ActionsSummarySectionSchema = z.object({
  type: z.literal("actions-summary"),
  id: z.string().optional(),
  props: CagnotteBaseSectionPropsSchema.extend({
    showKpis: z.boolean().optional().default(true),
    showCharts: z.boolean().optional().default(true),
    charts: z.object({
      statusDistribution: z.object({
        enabled: z.boolean().optional().default(true),
        type: z.enum(["pie", "bar", "list"]).optional().default("pie"),
      }).optional(),
      timeline: z.object({
        enabled: z.boolean().optional().default(true),
        type: z.enum(["bar", "line", "list"]).optional().default("bar"),
      }).optional(),
    }).optional(),
  }),
});

export type ActionsSummarySection = z.infer<typeof ActionsSummarySectionSchema>;
export type ActionsSummarySectionProps = z.infer<typeof ActionsSummarySectionSchema>["props"];

//──────────────── Finance Summary Section (Sidebar synthesis/charts)
export const FinanceSummarySectionSchema = z.object({
  type: z.literal("finance-summary"),
  id: z.string().optional(),
  props: CagnotteBaseSectionPropsSchema.extend({
    showKpis: z.boolean().optional().default(true),
    showCharts: z.boolean().optional().default(true),
    charts: z.object({
      fundingProgress: z.object({
        enabled: z.boolean().optional().default(true),
        type: z.enum(["progress", "bar", "list"]).optional().default("progress"),
      }).optional(),
      amountByMilestone: z.object({
        enabled: z.boolean().optional().default(true),
        type: z.enum(["bar", "list"]).optional().default("bar"),
      }).optional(),
    }).optional(),
  }),
});

export type FinanceSummarySection = z.infer<typeof FinanceSummarySectionSchema>;
export type FinanceSummarySectionProps = z.infer<typeof FinanceSummarySectionSchema>["props"];

//──────────────── Cagnotte Layout (wrap detail+summary sections in a CagnotteProvider)
/**
 * Section conteneur qui :
 *  - rend un `<CagnotteProvider>` interne (Context cagnotte avec event-bus typé)
 *  - dispose les `leftSections` (détail) et `rightSections` (sidebar synthèse) en 2 colonnes
 *  - permet aux sections cagnotte (`finance`, `actions`, `*-summary`) de communiquer
 *    sans `window.dispatchEvent` global
 *
 * Remplace l'usage de `profile-tab-layout` pour les pages cagnotte. Les sections
 * internes restent typées via `z.unknown()` (validées au runtime par leur propre schema).
 */
export const CagnotteLayoutSectionSchema = z.object({
  type: z.literal("cagnotte-layout"),
  id: z.string().optional(),
  props: z.object({
    leftSections: z.array(z.unknown()).optional().default([]),
    rightSections: z.array(z.unknown()).optional().default([]),
  }),
});

export type CagnotteLayoutSection = z.infer<typeof CagnotteLayoutSectionSchema>;
export type CagnotteLayoutSectionProps = z.infer<typeof CagnotteLayoutSectionSchema>["props"];
