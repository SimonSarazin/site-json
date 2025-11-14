import { useLocalization } from "@/hooks/useLocalization";
import { Footer } from "@/types/site-schema";

interface FooterTiersLieuxProps {
  footer: Footer;
}

export default function FooterTiersLieux({ footer }: FooterTiersLieuxProps) {
  const { t } = useLocalization();

  return (
    <footer className="bg-background pt-12 pb-6 border-t dark:border-(--themecolor)">
      <div className="container mx-auto">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img
            src={footer.logo || '/images/default-logo.png'}
            alt={footer.logoAlt ? t(footer.logoAlt) : ""}
            className="h-12"
          />
        </div>

        <nav className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm text-foreground mb-12">
          {footer.columns?.[0]?.links?.map((link, idx: number) => (
            <a
              key={idx}
              href={link.href}
              className="hover:text-tl-cyan dark:hover:text-theme-color text-foreground dark:text-gray-400 transition-colors"
            >
              {t(link.label)}
            </a>
          ))}
        </nav>

        {/* Bottom Section */}
        <div className="flex flex-wrap justify-between items-center text-xs text-gray-500 dark:text-gray-400 border-t dark:border-(--themecolor) pt-8">
          <p className="text-gray-500 dark:text-gray-400">{t(footer.copyright)}</p>
          <div className="flex gap-6 flex-wrap">
            {footer.legalLinks?.map((link, idx: number) => (
              <a
                key={idx}
                href={link.href}
                className="hover:text-tl-cyan dark:hover:text-theme-color text-gray-400 dark:text-gray-400 transition-colors"
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