import { useEffect, useRef, useState } from 'react';
import { T } from "@/components/ui/T";
import { cn } from '@/lib/utils';
import { DynamicIcon, type IconName } from 'lucide-react/dynamic';
import { StatsSectionProps } from '@/types/site-schema';
import { buildGridColsClass } from './responsiveGridCols';
import { StatValue } from './StatValue';

/**
 * Chiffre compté de 0 à sa valeur la PREMIÈRE fois que la section entre à l'écran, et une seule fois :
 * un compte qui arrive ensuite (tuile à `source`) s'affiche tel quel au lieu de relancer 0 → N sous
 * les yeux du visiteur. Le rendu serveur porte la vraie valeur, pas « 0 ».
 *
 * Défini au niveau du module : déclaré dans `StatsSection`, c'était un nouveau composant à chaque
 * rendu de la section — remonté, donc reparti de « 0 ».
 */
function AnimatedNumber({ value, isVisible, animated }: { value: string; isVisible: boolean; animated: boolean }) {
  // L'image en cours d'animation ; `null` hors animation : c'est alors `value` qui s'affiche.
  const [frame, setFrame] = useState<string | null>(null);
  // Monté alors que la section est DÉJÀ à l'écran (compte arrivé après l'entrée, chunk `lazy` qui
  // remplace son repli) : le chiffre s'affiche tel quel — l'animer ferait N → 0 → N.
  const hasAnimated = useRef(isVisible);

  useEffect(() => {
    if (!isVisible || !animated || hasAnimated.current) return;
    const target = parseInt(value.replace(/[^\d]/g, ''));
    if (isNaN(target)) return;
    hasAnimated.current = true;

    const duration = 2000; // 2 seconds
    const steps = 60;
    const increment = target / steps;
    const suffix = value.replace(/[\d,]/g, '');
    let current = 0;

    const start = setTimeout(() => setFrame('0'), 0);
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setFrame(null);
        clearInterval(timer);
      } else {
        setFrame(Math.floor(current).toLocaleString() + suffix);
      }
    }, duration / steps);

    return () => {
      clearTimeout(start);
      clearInterval(timer);
      // Interrompue (compte arrivé en cours de route) : on affiche la valeur, pas une image figée.
      setFrame(null);
    };
  }, [value, isVisible, animated]);

  return <span>{frame ?? value}</span>;
}

export function StatsSection({ id, props }: { id?: string; props: StatsSectionProps }) {
  const { items, design = 'default', layout = 'horizontal', animated = true, columns } = props;
  const [isVisible, setIsVisible] = useState(false);

  // `columns` (si fourni) pilote la grille ; sinon, défauts historiques par layout.
  const gridColsClass = columns
    ? buildGridColsClass(columns)
    : layout === 'horizontal'
      ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
      : "grid-cols-1 md:grid-cols-2";

  useEffect(() => {
    // Les tuiles n'animent pas leurs chiffres : un compte qui arrive APRÈS l'entrée à
    // l'écran repartirait de zéro sous les yeux du visiteur.
    if (!animated || design === 'tiles') return;
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
  }, [id, animated, design]);


  if (design === 'tiles') {
    return (
      <section id={id} className="px-4 py-3 sm:px-6 lg:px-8">
        <div className={cn("mx-auto grid max-w-6xl gap-5", buildGridColsClass(columns ?? { sm: 3 }))}>
          {items.map((item, index) => (
            <div
              key={index}
              className={cn(
                "flex flex-col gap-1.5 rounded-2xl border p-7",
                item.highlight
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border bg-card text-card-foreground"
              )}
            >
              <div className="text-5xl font-bold leading-none tracking-tight md:text-6xl">
                <StatValue
                  stat={item}
                  skeletonClassName={item.highlight ? "bg-primary-foreground/25" : undefined}
                >
                  {(value) => value}
                </StatValue>
              </div>
              <T
                k={item.label}
                as="span"
                className={cn("text-[15px] font-medium", !item.highlight && "text-muted-foreground")}
              />
              {item.description && (
                <T k={item.description} as="p" className="text-sm opacity-80" />
              )}
            </div>
          ))}
        </div>
      </section>
    );
  }

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
                  <StatValue stat={item}>
                    {(value) => <AnimatedNumber value={value} isVisible={isVisible} animated={animated} />}
                  </StatValue>
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
