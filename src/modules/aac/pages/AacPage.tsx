import { Link } from "react-router";
import { AlertCircle, Home } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { useSite } from "@/hooks/useSite";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import AacDirectorySection from "../sections/AacDirectorySection";
// Enregistre le bundle i18n "modules/aac". Les SECTIONS le font déjà ; sans cet
// import, une arrivée DIRECTE sur la route (lien partagé, F5) rendait la page
// avant tout enregistrement — et `t()` retournait les clés brutes.
import "../i18n";

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
 * Page AAC — route `/aac` (UN SEUL AAC par site : le formulaire vient de
 * `config.aac.formId`, jamais d'un paramètre d'URL).
 *
 * Elle n'est qu'une ENVELOPPE : le contenu est la section `aac-directory`, la
 * même que celle qu'un site peut poser sur n'importe quelle page de sa config.
 * Une seule implémentation, deux surfaces.
 */
export default function AacPage() {
  const { config: siteConfig } = useSite();

  if (!siteConfig.aac?.formId) return <AacNotFound />;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="container mx-auto px-6">
          <AacDirectorySection
            id="annuaire"
            props={{
              display: "grid",
              columns: 3,
              pageSize: 12,
              filters: {
                search: true,
                usage: true,
                tags: true,
                maturity: true,
                sort: true,
              },
              showDepositButton: true,
              variant: "full",
            }}
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
