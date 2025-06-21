import React from 'react';
import { Button } from '@/components/ui/button';
import { useLocalization } from '@/contexts/LocalizationContext';
import { useRouterContext } from '@/contexts/RouterContext';
import { cn } from '@/lib/utils';

interface CTASectionProps {
  id?: string;
  props: {
    headline: Record<string, string>;
    subhead?: Record<string, string>;
    backgroundImage?: string;
    backgroundColor?: string;
    buttons: Array<{
      label: Record<string, string>;
      href: string;
      variant?: 'default' | 'secondary' | 'outline' | 'ghost';
    }>;
    align?: 'left' | 'center' | 'right';
  };
}

export function CTASection({ id, props }: CTASectionProps) {
  const { t } = useLocalization();
  const { navigate } = useRouterContext();
  const { headline, subhead, backgroundImage, backgroundColor, buttons, align = 'center' } = props;

  const handleButtonClick = (href: string) => {
    if (href.startsWith('#')) {
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
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
          <h2 className={cn(
            "text-3xl md:text-5xl font-bold mb-6",
            backgroundImage ? "text-white" : "text-foreground"
          )}>
            {t(headline)}
          </h2>
          
          {subhead && (
            <p className={cn(
              "text-xl mb-8 opacity-90",
              backgroundImage ? "text-white" : "text-muted-foreground"
            )}>
              {t(subhead)}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {buttons.map((button, index) => (
              <Button
                key={index}
                variant={button.variant || 'default'}
                size="lg"
                className={cn(
                  "text-lg px-8 py-6",
                  backgroundImage && button.variant === 'default' && "bg-white text-black hover:bg-white/90",
                  backgroundImage && button.variant === 'outline' && "border-white text-white hover:bg-white hover:text-black"
                )}
                onClick={() => handleButtonClick(button.href)}
              >
                {t(button.label)}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}