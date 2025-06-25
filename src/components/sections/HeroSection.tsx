import { Button } from '@/components/ui/button';
import { useLocalization } from '@/contexts/LocalizationContext';
import { useNavigate } from "react-router";
import { cn } from '@/lib/utils';

interface HeroSectionProps {
  id?: string;
  props: {
    headline: Record<string, string>;
    subhead?: Record<string, string>;
    backgroundImage?: string;
    videoBg?: string;
    align?: 'left' | 'center' | 'right';
    overlay?: boolean;
    cta?: Array<{
      label: Record<string, string>;
      href: string;
      variant?: string;
    }>;
    scrollTo?: string;
  };
}

export function HeroSection({ id, props }: HeroSectionProps) {
  const { t } = useLocalization();
  const navigate = useNavigate();
  const { headline, subhead, backgroundImage, videoBg, align = 'center', overlay = false, cta, scrollTo } = props;

  const handleScrollTo = (target: string) => {
    const element = document.querySelector(target);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCTAClick = (href: string) => {
    if (href.startsWith('#')) {
      handleScrollTo(href);
    } else if (href.startsWith('http') || href.startsWith('//')) {
      window.open(href, '_blank', 'noopener,noreferrer');
    } else {
      navigate(href);
    }
  };

  return (
    <section 
      id={id}
      className={cn(
        "relative min-h-[70vh] flex items-center justify-center overflow-hidden"
      )}
    >
      {/* Background */}
      {backgroundImage && (
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
      )}
      
      {videoBg && (
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src={videoBg} type="video/mp4" />
        </video>
      )}

      {/* Overlay */}
      {overlay && (backgroundImage || videoBg) && (
        <div className="absolute inset-0 bg-black/50" />
      )}

      {/* Content */}
      <div className={cn(
        "relative z-10 container mx-auto px-4 sm:px-6 lg:px-8",
        (backgroundImage || videoBg) && "text-white"
      )}>
        <div className={cn(
          "max-w-4xl mx-auto",
          align === 'left' && "text-left",
          align === 'center' && "text-center",
          align === 'right' && "text-right"
        )}>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {t(headline)}
          </h1>
          
          {subhead && (
            <p className="text-xl md:text-2xl mb-8 opacity-90 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
              {t(subhead)}
            </p>
          )}

          {cta && cta.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-400">
              {cta.map((button, index) => (
                <Button
                  key={index}
                  variant={button.variant === 'secondary' ? 'secondary' : 'default'}
                  size="lg"
                  className="text-lg px-8 py-6"
                  onClick={() => handleCTAClick(button.href)}
                >
                  {t(button.label)}
                </Button>
              ))}
            </div>
          )}

          {scrollTo && (
            <div className="mt-12 animate-bounce">
              <Button
                variant="ghost"
                onClick={() => handleScrollTo(scrollTo)}
                className={cn(
                  (backgroundImage || videoBg) ? "text-white hover:text-white/80" : "text-foreground hover:text-foreground/80"
                )}
              >
                Scroll Down
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}