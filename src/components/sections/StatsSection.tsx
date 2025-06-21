import React, { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { useLocalization } from '@/contexts/LocalizationContext';
import { cn } from '@/lib/utils';

interface StatsSectionProps {
  id?: string;
  props: {
    items: Array<{
      value: string;
      label: Record<string, string>;
      description?: Record<string, string>;
      icon?: string;
    }>;
    layout?: 'horizontal' | 'vertical';
    animated?: boolean;
  };
}

export function StatsSection({ id, props }: StatsSectionProps) {
  const { t } = useLocalization();
  const { items, layout = 'horizontal', animated = true } = props;
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!animated) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    const element = document.getElementById(id || 'stats-section');
    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [id, animated]);

  const renderIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName];
    return IconComponent ? <IconComponent className="w-8 h-8" /> : null;
  };

  const AnimatedNumber = ({ value, isVisible }: { value: string; isVisible: boolean }) => {
    const [displayValue, setDisplayValue] = useState('0');

    useEffect(() => {
      if (!isVisible || !animated) {
        setDisplayValue(value);
        return;
      }

      const numericValue = parseInt(value.replace(/[^\d]/g, ''));
      if (isNaN(numericValue)) {
        setDisplayValue(value);
        return;
      }

      const duration = 2000; // 2 seconds
      const steps = 60;
      const increment = numericValue / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += increment;
        if (current >= numericValue) {
          setDisplayValue(value);
          clearInterval(timer);
        } else {
          const suffix = value.replace(/[\d,]/g, '');
          setDisplayValue(Math.floor(current).toLocaleString() + suffix);
        }
      }, duration / steps);

      return () => clearInterval(timer);
    }, [value, isVisible, animated]);

    return <span>{displayValue}</span>;
  };

  return (
    <section id={id || 'stats-section'} className="py-16 bg-primary/5 text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className={cn(
          "grid gap-8",
          layout === 'horizontal' && "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
          layout === 'vertical' && "grid-cols-1 md:grid-cols-2 gap-12"
        )}>
          {items.map((item, index) => (
            <div
              key={index}
              className={cn(
                "text-center group",
                layout === 'vertical' && "flex items-center gap-6 text-left"
              )}
            >
              {item.icon && (
                <div className={cn(
                  "text-primary mb-4 flex justify-center",
                  layout === 'vertical' && "mb-0 flex-shrink-0"
                )}>
                  {renderIcon(item.icon)}
                </div>
              )}
              
              <div className={layout === 'vertical' ? 'flex-1' : ''}>
                <div className={cn(
                  "text-4xl md:text-5xl font-bold text-foreground mb-2",
                  layout === 'vertical' && "text-3xl md:text-4xl"
                )}>
                  <AnimatedNumber value={item.value} isVisible={isVisible} />
                </div>
                
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  {t(item.label)}
                </h3>
                
                {item.description && (
                  <p className="text-muted-foreground text-sm">
                    {t(item.description)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}