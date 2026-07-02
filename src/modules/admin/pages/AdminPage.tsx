import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { useSite } from "@/hooks/useSite";

import { AdminRenderer } from "../AdminRenderer";
import { useAdminAccess } from "../hooks/useAdminAccess";

/**
 * Page `/admin` — jumeau de `ProfilePage`. Lit `config.admin`, garde via `useAdminAccess`, délègue à
 * `AdminRenderer`. CLIENT ISLAND : ne rend rien tant que non hydraté (les droits sont permission-dépendants
 * → pas de prefetch SSR, on évite un flash d'admin). cf. plan §1.
 */
export default function AdminPage() {
  const { config } = useSite();
  const admin = config?.admin;
  const access = useAdminAccess();

  if (!access.hydrated) return null;

  // Défensif : le config client peut être le JSON brut (defaults Zod pas garantis appliqués).
  if (!admin || admin.enabled === false) {
    return (
      <div className="container mx-auto py-16 text-center text-muted-foreground">
        Administration non activée sur ce site.
      </div>
    );
  }

  if (!access.has(admin.access?.min ?? "siteAdmin")) {
    return (
      <div className="container mx-auto py-16 text-center text-muted-foreground">
        Accès réservé aux administrateurs.
      </div>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="container mx-auto py-6">
        <h1 className="mb-4 text-2xl font-semibold">Administration</h1>
        <AdminRenderer config={admin} />
      </main>
      <SiteFooter />
    </>
  );
}
