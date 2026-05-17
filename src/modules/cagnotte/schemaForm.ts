import { z } from "zod";

/**
 * Schémas Zod pour les formulaires du module cagnotte (dialogs de création/édition
 * de milestones et d'actions, contributions). Suit le pattern de `src/modules/profil/schemaForm.ts`.
 *
 * À utiliser avec `react-hook-form` + `zodResolver` dans les dialogs.
 * Les clés d'erreur (`validation.<scope>.<field>.<rule>`) doivent être présentes dans
 * les fichiers i18n `src/modules/cagnotte/i18n/{fr,en}.json` sous une section `validation`.
 *
 * Distinct de `schema.ts` (sections JSON site-config) — ce fichier est dédié aux saisies
 * utilisateur, pas à la configuration déclarative du site.
 */

// ============================================================================
// SCHÉMAS PARTAGÉS
// ============================================================================

/**
 * Date au format français `DD/MM/YYYY` utilisé par `DatePickerInput`.
 * Accepte aussi la chaîne vide pour les champs optionnels.
 */
const frenchDateOrEmptySchema = z.union([
  z.string().regex(/^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/, "validation.date.frenchFormat"),
  z.literal(""),
]);

/**
 * Montant numérique positif ou nul. Côté UI, l'input HTML utilise `type="number"` +
 * `register(..., { valueAsNumber: true })` qui assure la coercion string → number avant
 * la validation Zod. Si tu as besoin d'accepter la virgule décimale (locale FR), parse
 * manuellement dans le `onValid` handler avant de mutate.
 */
const nonNegativeAmountSchema = z
  .number({ error: "validation.amount.invalid" })
  .min(0, "validation.amount.nonNegative")
  .finite("validation.amount.invalid");

/** Identifiant Mongo 24 chars hexa (utilisé pour milestoneId, projectId, etc.). */
const mongoIdSchema = z.string().regex(/^[a-f0-9]{24}$/, "validation.id.format");

// ============================================================================
// MILESTONE
// ============================================================================

/**
 * Schéma de **création** d'un milestone (CreateMilestoneDialog).
 * Le `status` est forcé à "open" côté handler (pas exposé dans le form).
 */
export const milestoneCreateFormSchema = z.object({
  name: z.string().trim().min(1, "validation.milestone.nameRequired"),
  description: z.string(),
  targetAmount: nonNegativeAmountSchema,
});

export type MilestoneCreateFormData = z.infer<typeof milestoneCreateFormSchema>;

/**
 * Schéma d'**édition** d'un milestone (MilestoneEditDialog + modal inline FinanceSection).
 * Ajoute `status` éditable (open / done / close).
 */
export const milestoneEditFormSchema = milestoneCreateFormSchema.extend({
  status: z.enum(["open", "done", "close"]),
});

export type MilestoneEditFormData = z.infer<typeof milestoneEditFormSchema>;

// ============================================================================
// ACTION
// ============================================================================

const actionStatusSchema = z.enum(["todo", "done"]);

/**
 * Schéma de **création** d'une action dans un milestone (ActionCreateDialog).
 * Les dates sont en format français (`DD/MM/YYYY`) tel que saisi par `DatePickerInput` ;
 * la validation cross-field (startDate ≤ endDate) est faite via `.superRefine`.
 */
/**
 * Schéma Zod pour un contributeur sélectionné via `<SelectMember>`.
 * Mirroir structurel de `SelectMemberValue` (cf. `src/components/form/SelectMember.tsx`).
 * Le champ `username` n'est présent que pour les Users (`type === "citoyens"`).
 */
const selectMemberValueSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  name: z.string(),
  username: z.string().optional(),
});

export const actionCreateFormSchema = z
  .object({
    name: z.string().trim().min(1, "validation.action.nameRequired"),
    credits: nonNegativeAmountSchema,
    status: actionStatusSchema,
    milestoneId: mongoIdSchema,
    tags: z.array(z.string()).max(10, "validation.action.tagsMax"),
    contributors: z.array(selectMemberValueSchema),
    startDate: frenchDateOrEmptySchema,
    endDate: frenchDateOrEmptySchema,
  })
  .superRefine((data, ctx) => {
    if (!data.startDate || !data.endDate) return;
    // Conversion DD/MM/YYYY → Date pour comparaison
    const [sd, sm, sy] = data.startDate.split("/").map(Number);
    const [ed, em, ey] = data.endDate.split("/").map(Number);
    const start = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);
    if (start > end) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "validation.action.dateRange",
      });
    }
  });

export type ActionCreateFormData = z.infer<typeof actionCreateFormSchema>;

/**
 * Schéma d'**édition** d'une action (ActionEditDialog).
 * Mêmes champs que création + `id` requis pour identifier l'action ciblée.
 */
export const actionEditFormSchema = z
  .object({
    id: z.string().min(1, "validation.action.idRequired"),
    name: z.string().trim().min(1, "validation.action.nameRequired"),
    credits: nonNegativeAmountSchema,
    status: actionStatusSchema,
    tags: z.array(z.string()).max(10, "validation.action.tagsMax"),
    contributors: z.array(selectMemberValueSchema),
    startDate: frenchDateOrEmptySchema,
    endDate: frenchDateOrEmptySchema,
  })
  .superRefine((data, ctx) => {
    if (!data.startDate || !data.endDate) return;
    const [sd, sm, sy] = data.startDate.split("/").map(Number);
    const [ed, em, ey] = data.endDate.split("/").map(Number);
    const start = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);
    if (start > end) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "validation.action.dateRange",
      });
    }
  });

export type ActionEditFormData = z.infer<typeof actionEditFormSchema>;

// ============================================================================
// CONTRIBUTION (CagnotteDialog)
// ============================================================================

/**
 * Allocation d'une partie du montant total sur un milestone donné.
 * Le `amount` doit être > 0 et ≤ au montant restant à financer du milestone (validé
 * côté composant car dépendant des données runtime, pas exprimable en Zod statique).
 */
const milestoneAllocationSchema = z.object({
  milestoneId: mongoIdSchema,
  amount: nonNegativeAmountSchema,
});

/**
 * Schéma de saisie d'une contribution (CagnotteDialog).
 * Le `paymentMethod` est validé séparément (peut être contraint par les méthodes
 * activées sur le projet — `stripe` / `helloasso`).
 */
export const contributionFormSchema = z.object({
  projectId: mongoIdSchema,
  totalAmount: nonNegativeAmountSchema.refine((value) => value > 0, {
    message: "validation.contribution.amountRequired",
  }),
  financerType: z.enum(["citoyens", "organizations"]),
  financerId: z.string().min(1, "validation.contribution.financerRequired"),
  allocations: z
    .array(milestoneAllocationSchema)
    .min(1, "validation.contribution.allocationsRequired"),
  paymentMethod: z.enum(["stripe", "helloasso"]).optional(),
});

export type ContributionFormData = z.infer<typeof contributionFormSchema>;
