import { z } from "zod";
import { LocalizedString } from "@/types/locale-schema";

/**
 * Schemas Zod pour le module Notification.
 *
 * Le module expose essentiellement une cloche dans le header (voir
 * `components/NotificationBell.tsx`), mais on déclare aussi une section JSON
 * `notifications` pour pouvoir afficher la liste plein-format sur une page
 * configurée en JSON (réutilise le même `NotificationPanel`).
 */
export const NotificationsSectionSchema = z.object({
  type: z.literal("notifications"),
  id: z.string().optional(),
  props: z.object({
    title: LocalizedString.optional(),
    maxItems: z.number().positive().optional().default(15),
    showMarkAllRead: z.boolean().optional().default(true),
    showClearAll: z.boolean().optional().default(true),
  }),
});

export type NotificationsSection = z.infer<typeof NotificationsSectionSchema>;
export type NotificationsSectionProps = z.infer<typeof NotificationsSectionSchema>["props"];
