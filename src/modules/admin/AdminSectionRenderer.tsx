import { createElement } from "react";

import AdminExportSection from "./sections/AdminExportSection";
import AdminImportSection from "./sections/AdminImportSection";
import AdminModerationSection from "./sections/AdminModerationSection";
import AdminReferenceSection from "./sections/AdminReferenceSection";
import AdminResourceTable from "./sections/AdminResourceTable";
import DashboardSection from "./sections/DashboardSection";
import MembersSection from "./sections/MembersSection";
import PlaceholderSection from "./sections/PlaceholderSection";
import { getAdminSection } from "./sections/registry";
import { useAdminAccess } from "./hooks/useAdminAccess";
import type { AdminAccessLevel, AdminSection } from "./schema";

/**
 * Mappe `section.type` → composant (jumeau de `ProfileSectionRenderer`).
 * BUILTIN via `switch` (JSX statique) ; `type` costum via le registre (`registerAdminSection`),
 * rendu par `createElement` (dispatch dynamique). P0 : seul dashboard/members sont implémentés ;
 * resource/import/export/reference/moderation pointent sur le placeholder (remplacés phase par phase).
 */
export function AdminSectionRenderer({ section }: { section: AdminSection }) {
  const access = useAdminAccess();
  // `access` par SECTION (surcharge page/onglet — promis par le schéma, câblé par l'audit config).
  const required = (section as { access?: AdminAccessLevel }).access;
  if (required && !access.has(required)) return null;
  switch (section.type) {
    case "dashboard":
      return <DashboardSection section={section} />;
    case "members":
      return <MembersSection section={section} />;
    case "resource":
      return <AdminResourceTable section={section} />;
    case "import":
      return <AdminImportSection section={section} />;
    case "export":
      return <AdminExportSection section={section} />;
    case "reference":
      return <AdminReferenceSection section={section} />;
    case "moderation":
      return <AdminModerationSection section={section} />;
    default:
      // Section costum enregistrée via `registerAdminSection`, sinon fallback.
      return createElement(getAdminSection(section.type) ?? PlaceholderSection, { section });
  }
}
