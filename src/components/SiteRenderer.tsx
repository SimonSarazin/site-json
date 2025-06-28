// src/SiteRenderer.tsx
import { useLocation } from "react-router"; // ✅
import { SiteHeader } from "./layout/SiteHeader";
import { SiteFooter } from "./layout/SiteFooter";
import { SectionRenderer } from "./sections/SectionRenderer";
import { useSite } from "@/contexts/SiteContext";
import { Seo } from "./layout/Seo";
import { usePageGuards } from "@/hooks/usePageGuards";

export function SiteRenderer() {
  const { config } = useSite();
  const { pathname } = useLocation(); // 🔄 remplace currentPath

  const currentPage =
    config.pages.find((p) => p.path === pathname) || config.pages[0];

  usePageGuards(currentPage);

  if (!currentPage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">404 – {pathname}</p>
      </div>
    );
  }

  return (
    <>
      <Seo page={currentPage} />
      <div className="min-h-screen flex flex-col">
        {!currentPage.hideHeader && <SiteHeader />}

        <main id="main" role="main" className="flex-1">
          {currentPage.sections.map((s, i) => (
            <SectionRenderer key={i} section={s} />
          ))}
        </main>

        {!currentPage.hideFooter && <SiteFooter />}
      </div>
    </>
  );
}
