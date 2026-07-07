import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { useSite } from "@/hooks/useSite";

import { useT } from "@/hooks/useT";
import "@/modules/admin/i18n";

import { AdminRenderer } from "../AdminRenderer";
import { useAdminAccess } from "../hooks/useAdminAccess";

/**
 * Page `/admin` — jumeau de `ProfilePage`. Lit `config.admin`, garde via `useAdminAccess`, délègue à
 * `AdminRenderer`. CLIENT ISLAND : ne rend rien tant que non hydraté (les droits sont permission-dépendants
 * → pas de prefetch SSR, on évite un flash d'admin). cf. plan §1.
 */
export default function AdminPage() {
  const t = useT();
  const tAdmin = useT("modules/admin");
  const { config } = useSite();
  const admin = config?.admin;
  const access = useAdminAccess();

  if (!access.hydrated) return null;

  // Défensif : le config client peut être le JSON brut (defaults Zod pas garantis appliqués).
  if (!admin || admin.enabled === false) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
        {tAdmin("AdminPage.notEnabled")}
      </div>
    );
  }

  if (!access.has(admin.access?.min ?? "siteAdmin")) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
        {tAdmin("AdminPage.accessDenied")}
      </div>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="container mx-auto px-4 py-6">
        <h1 className="mb-4 text-2xl font-semibold">{admin.title ? t(admin.title) : tAdmin("AdminPage.title")}</h1>
        <AdminRenderer config={admin} />
      </main>
      <SiteFooter />
    </>
  );
}
