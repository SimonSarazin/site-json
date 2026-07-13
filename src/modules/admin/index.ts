export { AdminConfigSchema } from "./schema";
export type { AdminConfig, AdminSection, AdminTab, AdminAccessLevel } from "./schema";
export { registerAdminSection, getAdminSection, listAdminSectionTypes } from "./sections/registry";
export type { AdminSectionComponent } from "./sections/registry";
export { useAdminAccess } from "./hooks/useAdminAccess";
export type { AdminAccess } from "./hooks/useAdminAccess";
