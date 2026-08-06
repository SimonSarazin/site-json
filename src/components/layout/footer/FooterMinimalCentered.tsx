import { useLocalization } from "@/hooks/useLocalization";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { Footer } from "@/types/site-schema";
import NavLink from "../NavLink";

interface FooterMinimalCenteredProps {
  footer: Footer;
}

export default function FooterMinimalCentered({ footer }: FooterMinimalCenteredProps) {
  const { t } = useLocalization();

  const bg = footer.backgroundImage;

  return (
    <footer
      className={`relative pt-8 sm:pt-12 pb-4 sm:pb-6 border-t ${bg ? "border-white/30 bg-neutral-800 bg-cover bg-center text-white" : "border-border bg-background"}`}
      style={bg ? { backgroundImage: `url(${bg.startsWith("/") ? bg : `/${bg}`})` } : undefined}
    >
      {/* Même traitement que le header stacked (qui partage typiquement la même
          image) : voile sombre en mode sombre — sans lui, le footer restait
          clair sur une page sombre — et `bg-neutral-800` SOUS l'image pour ses
          éventuelles zones semi-transparentes (canal alpha). */}
      {bg && <div aria-hidden className="absolute inset-0 pointer-events-none dark:bg-background/90" />}
      <div className="container mx-auto relative">

        <div className="flex justify-center mb-6 sm:mb-8">
          {footer.logo && (
            <OptimizedImage
              src={footer.logo.startsWith('/') ? footer.logo : `/${footer.logo}`}
              alt={footer.logoAlt ? t(footer.logoAlt) : (footer.logoTitle ? t(footer.logoTitle) : "Logo")}
              width={207}
              height={48}
              className="h-10 sm:h-12 object-contain"
              style={{ aspectRatio: '207/48' }}
              onError={(e) => {
                console.error('Footer logo failed to load:', footer.logo);
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
        </div>

        {/* `sm:text-base` (au lieu de `sm:text-sm`) : même cran d'agrandissement que le header en
            dehors de `xs` — la base (`text-xs`, < 475px) ne bouge pas. */}
        <nav className={`flex flex-wrap justify-center gap-x-4 sm:gap-x-8 gap-y-2 sm:gap-y-4 text-xs sm:text-base mb-8 sm:mb-12 ${bg ? "text-white" : "text-foreground"}`}>
          {footer.columns?.[0]?.links?.map((link, idx: number) => (
            <NavLink key={idx} to={link.href} className={bg ? "hover:opacity-80 transition-opacity" : "text-muted-foreground hover:text-primary transition-colors"}>
              {t(link.label)}
            </NavLink>
          ))}
        </nav>

        {/* `sm:text-sm` (au lieu de `sm:text-xs`) : même logique que la nav ci-dessus, base `text-[10px]`
            inchangée en xs. */}
        <div className={`flex flex-col sm:flex-row flex-wrap justify-between items-center gap-4 text-[10px] sm:text-sm pt-6 sm:pt-8 ${bg ? "border-white/30" : "text-muted-foreground border-border"} border-t`}>
          <p className={`text-center sm:text-left ${bg ? "" : "text-muted-foreground"}`}>{t(footer.copyright)}</p>
          <div className="flex gap-4 sm:gap-6 flex-wrap justify-center">
            {(footer.legalLinks ?? footer.bottomLinks)?.map((link, idx: number) => (
              <NavLink key={idx} to={link.href} className={bg ? "hover:opacity-80 transition-opacity" : "text-muted-foreground hover:text-primary transition-colors"}>
                {t(link.label)}
              </NavLink>
            ))}
          </div>
        </div>

      </div>
    </footer>
  );
}
