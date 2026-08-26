import { Button } from '@/components/ui/button';
import { T } from "@/components/ui/T";
import { useNavigate } from "react-router";
import { cn } from '@/lib/utils';
import { CTASectionProps } from '@/types/site-schema';
import { classifyHref } from '@/lib/linkKind';

export function CTASection({ id, props }: { id?: string; props: CTASectionProps }) {
  const navigate = useNavigate();
  const { headline, subhead, backgroundImage, backgroundColor, buttons, align = 'center' } = props;

  // Contrat 4 voies partagé avec NavLink et CardsSection (cf. src/lib/linkKind.ts). Avant, tout ce
  // qui n'était ni `#` ni `http` partait dans `navigate()` : un `tel:`/`mailto:` de config tombait
  // sur le catch-all et rendait la page d'accueil en 200 — sur mobile l'appel ne partait jamais.
  const handleButtonClick = (href: string) => {
    switch (classifyHref(href)) {
      case 'inert':
        return;
      case 'anchor': {
        document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
        return;
      }
      case 'protocol':
        // Handler OS (téléphone, client mail) : navigation de document, jamais un nouvel onglet.
        // `assign()` plutôt qu'une affectation de `location.href` : même effet, mais la règle
        // React Compiler interdit de MUTER un global (« This value cannot be modified »).
        window.location.assign(href);
        return;
      case 'external':
        window.open(href, '_blank', 'noopener,noreferrer');
        return;
      default:
        navigate(href);
    }
  };

  return (
    <section
      id={id}
      className={cn(
        "relative py-20 overflow-hidden",
        backgroundImage && "text-white"
      )}
      style={{
        backgroundColor: backgroundColor || undefined,
      }}
    >
      {/* Background Image */}
      {backgroundImage && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          />
          <div className="absolute inset-0 bg-black/50" />
        </>
      )}

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        <div className={cn(
          "max-w-4xl mx-auto",
          align === 'left' && "text-left",
          align === 'center' && "text-center",
          align === 'right' && "text-right"
        )}>
          <T
            k={headline}
            as="h2"
            className={cn(
              "text-3xl md:text-5xl font-bold mb-6",
              backgroundImage ? "text-white" : "text-foreground"
            )}
          />

          {subhead && (
            <T
              k={subhead}
              as="p"
              className={cn(
                "text-xl mb-8 opacity-90",
                backgroundImage ? "text-white" : "text-muted-foreground"
              )}
            />
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {buttons.map((button, index) => (
              <Button
                key={index}
                variant={button.variant || 'default'}
                size="lg"
                className={cn(
                  "text-lg px-8 py-6",
                  backgroundImage && button.variant === 'default' && "bg-background text-foreground hover:bg-background/90",
                  backgroundImage && button.variant === 'outline' && "border-background text-background hover:bg-background hover:text-foreground"
                )}
                onClick={() => handleButtonClick(button.href)}
              >
                <T k={button.label} />
              </Button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
export default CTASection;
