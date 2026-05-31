/**
 * Module Notification
 *
 * Cloche de notifications (header) + section JSON `notifications`, branchées sur
 * l'API stateless/plate de `@communecter/cocolight-api-client` (pensée React
 * Query / SSR). Approche Hybride : React Query possède la collection et le
 * badge ; chaque `Notification` possède son état lu via `item.markRead()`.
 */

// i18n (side-effect : enregistre le namespace modules/notification)
import "./i18n";

// Schemas + types
export * from "./schema";

// Constantes (query keys)
export * from "./constants/queryKeys";

// Hooks
export { useNotificationsList } from "./hooks/useNotificationsList";
export { useUnseenBadge } from "./hooks/useUnseenBadge";
export { useNotificationMutations } from "./hooks/useNotificationMutations";
export { useNotificationNavigation } from "./hooks/useNotificationNavigation";

// Utils
export { parseNotification } from "./utils/parseNotification";
export type { NotificationTarget, EntityCollection } from "./utils/parseNotification";
export { notificationTabIntent } from "./utils/notificationTabIntent";
export type { TabIntent } from "./utils/notificationTabIntent";

// Composants
export { default as NotificationBell } from "./components/NotificationBell";
export { NotificationPanel } from "./components/NotificationPanel";
export { NotificationRow } from "./components/NotificationRow";
