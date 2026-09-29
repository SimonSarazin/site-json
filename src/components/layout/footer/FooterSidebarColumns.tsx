import { useLocalization } from "@/hooks/useLocalization";
import { Footer } from "@/types/site-schema";
import { Waves, Shield, ExternalLink } from "lucide-react";
import NavLink from "../NavLink";
import SocialLinks from "./SocialLinks";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { IconOrSvg } from "@/components/ui/icon-or-svg";
import { FooterLinkColumn } from "./FooterLinkColumn";
import { useFooterColumns, useFooterLinks } from "./useFooterLinks";

const COLUMN_LINK_CLASS = "text-muted-foreground hover:text-primary transition-colors text-sm";

/**
 * Parts de la grille à partir de `lg` : le bloc logo + une par colonne de liens. Classes écrites
 * en toutes lettres — Tailwind ne génère que celles qu'il trouve littéralement dans le source.
 */
const LG_GRID_COLS: Record<number, string> = {
    0: "lg:grid-cols-1",
    1: "lg:grid-cols-2",
    2: "lg:grid-cols-3",
    3: "lg:grid-cols-4",
    4: "lg:grid-cols-5",
    5: "lg:grid-cols-6",
};

interface FooterSidebarColumnsProps {
    footer: Footer;
    /** Sous-style visuel : "plain" (fond plein, défaut) ou "card" (aspect carte). */
    style?: "plain" | "card";
}

export default function FooterSidebarColumns({ footer, style }: FooterSidebarColumnsProps) {
    const { t } = useLocalization();
    const isCard = style === "card";

    const footerClasses = isCard
        ? "bg-card border-t border-border/30"
        : "bg-background border-t border-secondary/30";

    const socialClasses = isCard
        ? "p-2 rounded-full bg-card hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors border border-border/50"
        : "p-2 rounded-full bg-secondary/30 hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors";

    const borderClasses = isCard
        ? "border-border/30"
        : "border-secondary/30";

    const DefaultIcon = isCard ? Shield : Waves;

    // Au-delà de 5 colonnes, la grille plafonne à 6 parts et les colonnes suivantes passent à la ligne.
    const lgGridCols = LG_GRID_COLS[footer.columns?.length ?? 0] ?? "lg:grid-cols-6";

    const columns = useFooterColumns(footer.columns);
    const legalLinks = useFooterLinks(footer.legalLinks);
    const bottomLinks = useFooterLinks(footer.bottomLinks);

    return (
        <footer className={footerClasses}>
            {/* Mêmes marges latérales que le header : `px-4` seul décale le pied de page
                vers l'extérieur au-delà de `sm`. */}
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className={`grid md:grid-cols-2 ${lgGridCols} gap-8 mb-12`}>
                    <div className="lg:col-span-1">
                        <NavLink to="/" className="flex items-center gap-3 mb-4">
                            {footer.logo ? (
                                <OptimizedImage
                                    src={footer.logo.startsWith('/') ? footer.logo : `/${footer.logo}`}
                                    width={32}
                                    height={32}
                                    alt={footer.logoAlt ? t(footer.logoAlt) : (footer.logoTitle ? t(footer.logoTitle) : "Logo")}
                                    className="h-8 w-8 object-contain"
                                />
                            ) : footer.logoIcon ? (
                                <IconOrSvg value={footer.logoIcon} className="w-8 h-8 text-primary" />
                            ) : (
                                <DefaultIcon className="w-8 h-8 text-primary" />
                            )}
                            {footer.logoTitle && (
                                <span className="text-xl font-bold text-foreground">{t(footer.logoTitle)}</span>
                            )}
                        </NavLink>

                        {footer.description && (
                            <p className="text-muted-foreground mb-4">
                                {t(footer.description)}
                            </p>
                        )}

                        {footer.website && (
                            <NavLink
                                to={footer.website}
                                external
                                className="inline-flex items-center gap-2 text-primary hover:underline text-sm mb-6"
                            >
                                {footer.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                                <ExternalLink className="w-4 h-4" />
                            </NavLink>
                        )}

                        <SocialLinks
                            socials={footer.socials}
                            className={`gap-3 ${isCard ? 'mt-6' : ''}`}
                            itemClassName={socialClasses}
                            iconClassName="w-5 h-5"
                        />
                    </div>

                    {columns.map(({ column, links }, index) => (
                        <FooterLinkColumn key={index} column={column} links={links} linkClassName={COLUMN_LINK_CLASS} />
                    ))}
                </div>

                <div className={`pt-8 border-t ${borderClasses} flex flex-col md:flex-row justify-between items-center gap-4`}>
                    <p className="text-sm text-muted-foreground">
                        {t(footer.copyright)}
                    </p>
                    <div className="flex flex-col items-end gap-3">
                        {footer.extra && (
                            <p
                                className="text-sm text-muted-foreground text-right"
                                dangerouslySetInnerHTML={{ __html: footer.extra }}
                            />
                        )}
                        <div className="flex gap-6 text-sm text-muted-foreground">
                            {legalLinks.map((link, idx) => (
                                <NavLink
                                    key={idx}
                                    to={link.href}
                                    className="hover:text-primary transition-colors"
                                >
                                    {t(link.label)}
                                </NavLink>
                            ))}
                            {bottomLinks.map((link, idx) => (
                                <NavLink
                                    key={`bottom-${idx}`}
                                    to={link.href}
                                    className="hover:text-primary transition-colors"
                                >
                                    {t(link.label)}
                                </NavLink>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
