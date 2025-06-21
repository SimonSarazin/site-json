import React from 'react';
import { useLocalization } from '@/contexts/LocalizationContext';
import { cn } from '@/lib/utils';

interface LogoCloudSectionProps {
  id?: string;
  props: {
    title?: Record<string, string>;
    logos: Array<{
      src: string;
      alt: Record<string, string>;
      href?: string;
    }>;
    grayscale?: boolean;
    animated?: boolean;
  };
}

export function LogoCloudSection({ id, props }: LogoCloudSectionProps) {
  const { t } = useLocalization();
  const { title, logos, grayscale = true, animated = false } = props;

  const LogoItem = ({ logo, index }: { logo: any; index: number }) => {
    const content = (
      <div className={cn(
        "flex items-center justify-center p-4 transition-all duration-200",
        grayscale && "grayscale hover:grayscale-0",
        "hover:scale-110"
      )}>
        <img
          src={logo.src}
          alt={t(logo.alt)}
          className="max-h-12 w-auto object-contain"
        />
      </div>
    );

    if (logo.href) {
      return (
        <a
          key={index}
          href={logo.href}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          {content}
        </a>
      );
    }

    return <div key={index}>{content}</div>;
  };

  return (
    <section id={id} className="py-16 bg-muted/30 text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {title && (
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              {t(title)}
            </h2>
          </div>
        )}

        {animated ? (
          <div className="overflow-hidden">
            <div className="flex animate-marquee gap-8">
              {[...logos, ...logos].map((logo, index) => (
                <div key={index} className="flex-shrink-0">
                  <LogoItem logo={logo} index={index} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-8">
            {logos.map((logo, index) => (
              <LogoItem key={index} logo={logo} index={index} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}