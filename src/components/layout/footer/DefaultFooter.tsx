import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Github, Twitter, Linkedin, Facebook, Instagram, Youtube } from 'lucide-react';
import { useLocalization } from "@/hooks/useLocalization";
import { useSite } from '@/hooks/useSite';

const SocialIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  github: Github,
  twitter: Twitter,
  linkedin: Linkedin,
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
};

export function DefaultFooter() {
  const { config } = useSite();
  const { t } = useLocalization();
  const { footer } = config;

  return (
    <footer className="border-t border-border bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Newsletter Section */}
        {footer.newsletter && (
          <div className="mb-12 p-8 rounded-lg bg-linear-to-r from-primary/5 to-secondary/5 border border-border">
            <div className="max-w-2xl mx-auto text-center">
              <h3 className="text-2xl font-bold mb-2 text-foreground">
                {t(footer.newsletter.props.headline)}
              </h3>
              {footer.newsletter.props.subhead && (
                <p className="text-muted-foreground mb-6">
                  {t(footer.newsletter.props.subhead)}
                </p>
              )}
              <form
                action={footer.newsletter.props.formAction}
                method="POST"
                className="flex gap-2 max-w-md mx-auto"
              >
                <Input
                  type="email"
                  name="email"
                  placeholder={
                    footer.newsletter.props.emailPlaceholder
                      ? t(footer.newsletter.props.emailPlaceholder)
                      : 'Enter your email...'
                  }
                  className="flex-1"
                  required
                />
                <Button type="submit">
                  {t(footer.newsletter.props.submitLabel)}
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* Footer Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {(footer.columns ?? []).map((column, index) => (
            <div key={index}>
              <h4 className="font-semibold mb-4 text-foreground">{t(column.title)}</h4>
              <ul className="space-y-2">
                {column.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <a
                      href={link.href}
                      className="text-muted-foreground dark:text-gray-400 hover:text-foreground dark:hover:text-primary transition-colors"
                      target={link.external ? '_blank' : '_self'}
                      rel={link.external ? 'noopener noreferrer' : undefined}
                    >
                      {t(link.label)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Section */}
        <div className="pt-8 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            {t(footer.copyright)}
          </p>

          {/* Social Links */}
          {footer.socials && footer.socials.length > 0 && (
            <div className="flex items-center gap-2">
              {footer.socials.map((social, index) => {
                const IconComponent = SocialIcons[social.platform.toLowerCase()];
                return IconComponent ? (
                  <Button
                    key={index}
                    variant="ghost"
                    size="sm"
                    asChild
                  >
                    <a
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.platform}
                    >
                      <IconComponent className="h-4 w-4" />
                    </a>
                  </Button>
                ) : null;
              })}
            </div>
          )}
        </div>

        {/* Extra Content */}
        {footer.extra && (
          <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
            <div dangerouslySetInnerHTML={{ __html: footer.extra }} />
          </div>
        )}
      </div>
    </footer>
  );
}

export default DefaultFooter;