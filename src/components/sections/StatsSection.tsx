import { useEffect, useState } from 'react';
import { T } from "@/components/ui/T";
import { cn } from '@/lib/utils';
import { DynamicIcon, type IconName } from 'lucide-react/dynamic';
import { StatsSectionProps } from '@/types/site-schema';
import { buildGridColsClass } from './responsiveGridCols';

export function StatsSection({ id, props }: { id?: string; props: StatsSectionProps }) {
  const { items, layout = 'horizontal', animated = true, columns } = props;
  const [isVisible, setIsVisible] = useState(false);

  // `columns` (si fourni) pilote la grille ; sinon, défauts historiques par layout.
  const gridColsClass = columns
    ? buildGridColsClass(columns)
    : layout === 'horizontal'
      ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
      : "grid-cols-1 md:grid-cols-2";

  useEffect(() => {
    if (!animated) return;
    if (typeof window === 'undefined') return;

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
    }, [value, isVisible]);

    return <span>{displayValue}</span>;
  };

  return (
    <section id={id || 'stats-section'} className="py-16 bg-primary/5 text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className={cn(
          "grid gap-8",
          gridColsClass,
          layout === 'vertical' && "gap-12"
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
                  layout === 'vertical' && "mb-0 shrink-0"
                )}>
                  <DynamicIcon
                name={item.icon as IconName}
                className="w-8 h-8"
              />
                </div>
              )}

              <div className={layout === 'vertical' ? 'flex-1' : ''}>
                <div className={cn(
                  "text-4xl md:text-5xl font-bold text-foreground mb-2",
                  layout === 'vertical' && "text-3xl md:text-4xl"
                )}>
                  <AnimatedNumber value={item.value} isVisible={isVisible} />
                </div>

                <T k={item.label} as="h3" className="text-lg font-semibold text-foreground mb-1" />

                {item.description && (
                  <T k={item.description} as="p" className="text-muted-foreground text-sm" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
export default StatsSection;
