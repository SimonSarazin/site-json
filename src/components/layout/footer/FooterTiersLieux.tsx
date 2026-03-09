import { useLocalization } from "@/hooks/useLocalization";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { Footer } from "@/types/site-schema";

interface FooterTiersLieuxProps {
  footer: Footer;
}

export default function FooterTiersLieux({ footer }: FooterTiersLieuxProps) {
  const { t } = useLocalization();

  return (
    <footer className="bg-background pt-8 sm:pt-12 pb-4 sm:pb-6 border-t border-border">
      <div className="container mx-auto">

        <div className="flex justify-center mb-6 sm:mb-8">
          {footer.logo && (
            <OptimizedImage
              src={footer.logo.startsWith('/') ? footer.logo : `/${footer.logo}`}
              alt={footer.logoAlt ? t(footer.logoAlt) : ""}
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

        <nav className="flex flex-wrap justify-center gap-x-4 sm:gap-x-8 gap-y-2 sm:gap-y-4 text-xs sm:text-sm text-foreground mb-8 sm:mb-12">
          {footer.columns?.[0]?.links?.map((link, idx: number) => (
            <a
              key={idx}
              href={link.href}
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              {t(link.label)}
            </a>
          ))}
        </nav>

        <div className="flex flex-col sm:flex-row flex-wrap justify-between items-center gap-4 text-[10px] sm:text-xs text-muted-foreground border-t border-border pt-6 sm:pt-8">
          <p className="text-muted-foreground text-center sm:text-left">{t(footer.copyright)}</p>
          <div className="flex gap-4 sm:gap-6 flex-wrap justify-center">
            {footer.legalLinks?.map((link, idx: number) => (
              <a
                key={idx}
                href={link.href}
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                {t(link.label)}
              </a>
            ))}
          </div>
        </div>

      </div>
    </footer>
  );
}