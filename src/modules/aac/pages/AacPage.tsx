import { Link } from "react-router";
import { AlertCircle, Home } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { useSite } from "@/hooks/useSite";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import AacConfigStub from "../components/AacConfigStub";

/**
 * Les routes de module sont montées sous `RootLayout` (providers + `<Outlet/>`),
 * PAS sous `SiteRenderer` — c'est lui qui rend le header/footer des pages
 * pilotées par le JSON. Une page de module doit donc rendre le chrome du site
 * ELLE-MÊME (même patron que `AmpliPage` / `ProfilePage` / `CoFormPage`),
 * sinon le menu disparaît.
 */

/** Page d'erreur « aucun AAC déclaré » — même chrome que la page nominale. */
function AacNotFound() {
  useLoadNamespace("modules/aac");
  const t = useT("modules/aac");
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="flex justify-center">
            <div className="p-6 rounded-full bg-muted/50 ring-1 ring-border shadow-sm">
              <AlertCircle className="w-12 h-12 text-muted-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {String(t("section.noForm"))}
          </h1>
          <div className="pt-4">
            <Button asChild variant="outline" className="gap-2">
              <Link to="/">
                <Home className="w-4 h-4" />
                {String(t("page.backHome"))}
              </Link>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

/**
 * Page AAC — SOCLE (stub). Route `/aac` (UN SEUL AAC par site : le formulaire
 * vient de `config.aac.formId`). Deviendra le listing / la fiche d'un commun
 * aux phases suivantes.
 */
export default function AacPage() {
  const { config: siteConfig } = useSite();

  if (!siteConfig.aac?.formId) return <AacNotFound />;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="container mx-auto px-6 py-8">
          <AacConfigStub props={{}} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
