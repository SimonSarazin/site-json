import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocalization } from "@/hooks/useLocalization";
import { Footer } from '@/types/site-schema';
import NavLink from '../NavLink';
import SocialLinks from './SocialLinks';

interface FooterRichProps {
  footer: Footer;
}

export function FooterRich({ footer }: FooterRichProps) {
  const { t } = useLocalization();

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
                    <NavLink
                      to={link.href}
                      external={link.external}
                      className="text-muted-foreground dark:text-gray-400 hover:text-foreground dark:hover:text-primary transition-colors"
                    >
                      {t(link.label)}
                    </NavLink>
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
          <SocialLinks socials={footer.socials} className="flex items-center gap-2" />
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

export default FooterRich;