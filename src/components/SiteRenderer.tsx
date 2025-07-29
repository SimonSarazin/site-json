// src/SiteRenderer.tsx
import { useLocation } from "react-router"; // ✅
import { SiteHeader } from "./layout/SiteHeader";
import { SiteFooter } from "./layout/SiteFooter";
import { SectionRenderer } from "./sections/SectionRenderer";
import { useSite } from "@/contexts/SiteContext";
import { Seo } from "./layout/Seo";
import { usePageGuards } from "@/hooks/usePageGuards";
// import { SiteHeader2 } from "./layout/SiteHeader2";

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

  const layout = currentPage.layout;

function getLayoutClasses(layout: string) {
  switch (layout) {
    case "fullwidth":
      return "w-full"; 
    // case "sidebar-left":
    //   return "grid grid-cols-12 gap-8 px-4";
    // case "sidebar-right":
    //   return "grid grid-cols-12 gap-8 px-4";
    case "default":
    default:
      return "max-w-7xl mx-auto";
  }
}

  return (
    <>
      <Seo page={currentPage} />
      <div className={`min-h-screen flex flex-col ${getLayoutClasses(layout)}`}>
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
