import { useLocalization } from "@/hooks/useLocalization";
import { Footer } from "@/types/site-schema";
import { Waves, Facebook, Twitter, Instagram, Linkedin, Mail, Youtube } from "lucide-react";
import { Link } from "react-router";

interface FooterRezoLaMerProps {
    footer: Footer;
}

const socialIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    facebook: Facebook,
    twitter: Twitter,
    instagram: Instagram,
    linkedin: Linkedin,
    mail: Mail,
    youtube: Youtube,
};

export default function FooterRezoLaMer({ footer }: FooterRezoLaMerProps) {
    const { t } = useLocalization();

    return (
        <footer className="bg-background border-t border-secondary/30">
            <div className="container mx-auto px-4 py-16">
                <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
                    <div className="lg:col-span-1">
                        <Link to="/" className="flex items-center gap-3 mb-4">
                            {footer.logo ? (
                                <img
                                    src={footer.logo.startsWith('/') ? footer.logo : `/${footer.logo}`}
                                    alt={footer.logoAlt ? t(footer.logoAlt) : ""}
                                    className="h-8 w-8 object-contain"
                                />
                            ) : footer.logoIcon ? (
                                <span
                                    className="w-8 h-8 text-primary flex items-center justify-center [&>svg]:w-8 [&>svg]:h-8"
                                    dangerouslySetInnerHTML={{ __html: footer.logoIcon }}
                                />
                            ) : (
                                <Waves className="w-8 h-8 text-primary" />
                            )}
                            {footer.logoTitle && (
                                <span className="text-xl font-bold text-foreground">{t(footer.logoTitle)}</span>
                            )}
                        </Link>

                        {footer.description && (
                            <p className="text-muted-foreground mb-6">
                                {t(footer.description)}
                            </p>
                        )}

                        {footer.socials && footer.socials.length > 0 && (
                            <div className="flex gap-3">
                                {footer.socials.map((social, idx) => {
                                    const IconComponent = socialIcons[social.platform.toLowerCase()];
                                    return (
                                        <a
                                            key={idx}
                                            href={social.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 rounded-full bg-secondary/30 hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                                            aria-label={social.platform}
                                        >
                                            {IconComponent ? (
                                                <IconComponent className="w-5 h-5" />
                                            ) : (
                                                <Mail className="w-5 h-5" />
                                            )}
                                        </a>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {footer.columns?.map((column, index) => (
                        <div key={index}>
                            <h3 className="font-semibold mb-4 text-foreground">{t(column.title)}</h3>
                            <ul className="space-y-2">
                                {column.links?.map((link, linkIdx) => (
                                    <li key={linkIdx}>
                                        <Link
                                            to={link.href}
                                            className="text-muted-foreground hover:text-primary transition-colors text-sm"
                                        >
                                            {t(link.label)}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="pt-8 border-t border-secondary/30 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-muted-foreground">
                        {t(footer.copyright)}
                    </p>
                    <div className="flex gap-6 text-sm text-muted-foreground">
                        {footer.legalLinks?.map((link, idx) => (
                            <Link
                                key={idx}
                                to={link.href}
                                className="hover:text-primary transition-colors"
                            >
                                {t(link.label)}
                            </Link>
                        ))}
                        {footer.bottomLinks?.map((link, idx) => (
                            <Link
                                key={`bottom-${idx}`}
                                to={link.href}
                                className="hover:text-primary transition-colors"
                            >
                                {t(link.label)}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </footer>
    );
}
