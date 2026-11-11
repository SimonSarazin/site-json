import { z } from "zod";

/** Types de kanban qu'un site peut proposer sur `/kanban` (registre : `components/home/boardTypes.ts`). */
export const KANBAN_BOARD_TYPE_IDS = ["actions", "roles"] as const;
export type KanbanBoardTypeId = (typeof KANBAN_BOARD_TYPE_IDS)[number];

/**
 * Bloc de config du module kanban AU NIVEAU DU SITE (`config.kanban`).
 *
 * Sa présence suffit à monter `/kanban` (cf. `routes.tsx`) : `"kanban": {}` propose les deux
 * kanbans de l'élément porteur. `boards` restreint la liste et fixe leur ordre à l'écran.
 * Zod ne relit pas la config à l'exécution : le code reste défensif (`visibleBoardTypes`).
 */
export const KanbanConfigSchema = z.object({
  boards: z
    .array(z.enum(KANBAN_BOARD_TYPE_IDS))
    .min(1)
    .refine((boards) => new Set(boards).size === boards.length, "un kanban ne figure qu'une fois dans `boards`")
    .optional(),
});
export type KanbanConfig = z.infer<typeof KanbanConfigSchema>;
