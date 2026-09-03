import NavLink from "../NavLink";
import SocialLinks from "./SocialLinks";
import { MapPin, Phone, Mail, Globe, Building2, Clock } from "lucide-react";
import { useLocalization } from "@/hooks/useLocalization";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
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
  clock: Clock,
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
  // Le repli du titre de contact était écrit EN DUR en français : un site qui
  // omet `contactSection.title` servait « Nos coordonnées » à un visiteur
  // anglophone. `t` de useLocalization ne résout que les LocalizedString ;
  // les clés i18n passent par useT.
  useLoadNamespace("components/layout");
  const tKey = useT("components/layout");
  const contactItems = footer.contactSection?.items ?? [];
  const partnerLogos = footer.partners?.logos ?? [];
  const columns = footer.columns ?? [];

  return (
    <footer className="bg-background border-t border-border">
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row items-start gap-10">

          {/* Contact items */}
          {contactItems.length > 0 && (
            <div className={partnerLogos.length === 1 ? "w-full" : "w-full md:w-auto"}>
              <h4 className="font-display font-bold text-foreground text-lg mb-4">
                {footer.contactSection?.title ? t(footer.contactSection.title) : tKey("Nos coordonnées")}
              </h4>
              <ul
                className={`text-sm text-muted-foreground ${
                  partnerLogos.length === 1
                    ? `grid gap-4 ${
                        contactItems.length === 1
                          ? "grid-cols-1"
                          : contactItems.length === 2
                            ? "grid-cols-1 sm:grid-cols-2"
                            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                      }`
                    : "space-y-3"
                }`}
              >
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
                      {item.value && (
                        <span className={item.lines?.length ? "block" : undefined}>
                          {t(item.value)}
                        </span>
                      )}
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

          {/* Logos */}
          {partnerLogos.length > 0 && (
            <div className={partnerLogos.length > 1 ? "flex-1 w-full min-w-0" : "shrink-0"}>
              {footer.partners?.title && (
                <h4 className="font-display font-bold text-foreground text-lg mb-4">
                  {t(footer.partners.title)}
                </h4>
              )}
              <div
                className={
                  partnerLogos.length > 1
                    ? "grid grid-cols-2 md:grid-cols-3 gap-8 items-center justify-items-center"
                    : "flex items-center justify-center md:justify-end"
                }
              >
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
                    // `max-w-full` : ces bandeaux sont larges (ratios 3:1 à 5:1) ; à
                    // hauteur fixe et largeur libre, ils débordent de leur colonne de
                    // grille dès qu'on en aligne plus de trois.
                    className="h-24 md:h-32 w-auto max-w-full object-contain hover:opacity-85 transition-opacity"
                  />
                ) : (
                  <OptimizedImage
                    src={logo.image}
                    alt={t(logo.alt)}
                    height={128}
                    // `max-w-full` : ces bandeaux sont larges (ratios 3:1 à 5:1) ; à
                    // hauteur fixe et largeur libre, ils débordent de leur colonne de
                    // grille dès qu'on en aligne plus de trois.
                    className="h-24 md:h-32 w-auto max-w-full object-contain hover:opacity-85 transition-opacity"
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
              {/* Mention de financement : sous les logos, en petit — c'est une
                  obligation contractuelle, pas un argument de communication. */}
              {footer.partners?.note && (
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  {t(footer.partners.note)}
                </p>
              )}
            </div>
          )}

        </div>

        {/* Colonnes de navigation + réseaux sociaux.
            Optionnels : les 5 sites historiques en `contact-partners` n'en déclarent
            aucun et rendent donc exactement comme avant. Ils existent pour les
            portails qui ont une vraie navigation de pied de page à porter en plus
            du bloc contact/partenaires (sinon il faudrait choisir entre les deux). */}
        {(columns.length > 0 || (footer.socials?.length ?? 0) > 0) && (
          <div className="mt-10 pt-8 border-t border-border flex flex-col gap-8 md:flex-row md:justify-between">
            {columns.length > 0 && (
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {columns.map((column, index) => (
                  <div key={index}>
                    <h3 className="font-semibold mb-4 text-foreground">{t(column.title)}</h3>
                    <ul className="space-y-2">
                      {column.links?.map((link, linkIdx) => (
                        <li key={linkIdx}>
                          <NavLink
                            to={link.href}
                            className="text-muted-foreground hover:text-primary transition-colors text-sm"
                          >
                            {t(link.label)}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            <SocialLinks
              socials={footer.socials}
              className="gap-3 shrink-0"
              itemClassName="text-muted-foreground hover:text-primary transition-colors"
              iconClassName="w-5 h-5"
            />
          </div>
        )}
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
