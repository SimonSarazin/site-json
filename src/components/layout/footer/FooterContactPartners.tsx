import NavLink from "../NavLink";
import { MapPin, Phone, Mail, Globe, Building2 } from "lucide-react";
import { useLocalization } from "@/hooks/useLocalization";
import { Footer } from "@/types/site-schema";
import { OptimizedImage } from "@/components/ui/OptimizedImage";

interface FooterContactPartnersProps {
  footer: Footer;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "map-pin": MapPin,
  "pin": MapPin,
  location: MapPin,
  address: MapPin,
  phone: Phone,
  tel: Phone,
  mail: Mail,
  email: Mail,
  contact: Mail,
  globe: Globe,
  website: Globe,
  building: Building2,
};

function getIconComponent(icon?: string) {
  if (!icon) {
    return MapPin;
  }
  const key = icon.toLowerCase();
  return iconMap[key] ?? MapPin;
}

export default function FooterContactPartners({ footer }: FooterContactPartnersProps) {
  const { t } = useLocalization();
  const contactItems = footer.contactSection?.items ?? [];
  const partnerLogos = footer.partners?.logos ?? [];

  return (
    <footer className="bg-background border-t border-border">
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-10">
          {contactItems.length > 0 && (
            <div className="w-full md:w-auto">
              <h4 className="font-display font-bold text-foreground text-lg mb-4">
                {footer.contactSection?.title ? t(footer.contactSection.title) : "Nos coordonnées"}
              </h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {contactItems.map((item, idx) => {
                  const Icon = getIconComponent(item.icon);
                  const content = (
                    <span className="leading-relaxed">
                      {item.label && (
                        <span className="block text-foreground font-medium">
                          {t(item.label)}
                        </span>
                      )}
                      {item.lines?.map((line, lineIdx) => (
                        <span key={lineIdx} className={lineIdx > 0 ? "block" : undefined}>
                          {t(line)}
                        </span>
                      ))}
                      {item.value && <span className={item.lines?.length ? "block" : undefined}>{t(item.value)}</span>}
                    </span>
                  );

                  return (
                    <li key={idx} className="flex items-start gap-3">
                      <Icon className="text-primary mt-0.5 shrink-0 h-5 w-5" />
                      {item.href ? (
                        <NavLink to={item.href} className="hover:text-foreground transition-colors">
                          {content}
                        </NavLink>
                      ) : (
                        content
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {partnerLogos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 items-center justify-items-center flex-1 w-full">
              {partnerLogos.map((logo, idx) => {
                // Logos partenaires LOCAUX → /img (redimensionne + avif/webp). Les logos
                // EXTERNES restent en <img> brut (domaine non-allowlisté → /img renverrait 403).
                const isExternal = /^https?:\/\//.test(logo.image);
                const logoContent = isExternal ? (
                  <img
                    src={logo.image}
                    alt={t(logo.alt)}
                    loading="lazy"
                    width={160}
                    height={96}
                    className="h-24 md:h-32 w-auto object-contain hover:opacity-85 transition-opacity"
                  />
                ) : (
                  <OptimizedImage
                    src={logo.image}
                    alt={t(logo.alt)}
                    height={128}
                    className="h-24 md:h-32 w-auto object-contain hover:opacity-85 transition-opacity"
                  />
                );

                return (
                  <NavLink
                    key={idx}
                    to={logo.href}
                    external
                    className="inline-flex items-center justify-center dark:rounded-lg dark:bg-white dark:p-3 dark:shadow-sm"
                  >
                    {logoContent}
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>{t(footer.copyright)}</p>
          {footer.legalLinks && footer.legalLinks.length > 0 && (
            <div className="flex flex-wrap items-center gap-4">
              {footer.legalLinks.map((link, idx) => (
                <NavLink key={idx} to={link.href} className="hover:text-foreground transition-colors underline">
                  {t(link.label)}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
