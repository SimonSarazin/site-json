import { Calendar } from 'lucide-react';
import { T } from "@/components/ui/T";
import { cn } from '@/lib/utils';
import { TimelineSectionProps } from '@/types/site-schema';
import { formatDateLong } from '@/helpers/formatDate';

export function TimelineSection({ id, props }: { id?: string; props: TimelineSectionProps }) {
  const { events, alternating = true } = props;

  return (
    <section id={id} className="py-16 bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Timeline Line : à gauche en mobile, centrée à partir de md */}
            <div className="absolute left-4 md:left-1/2 -translate-x-1/2 w-0.5 h-full bg-border" />

            {events.map((event, index) => {
              const onLeft = alternating && index % 2 === 0;
              return (
              <div
                key={index}
                className={cn(
                  "relative flex items-center mb-12 last:mb-0",
                  // Mobile : colonne unique. md+ : alterne gauche/droite.
                  onLeft ? "md:flex-row" : "md:flex-row-reverse"
                )}
              >
                {/* Content : pleine largeur (décalée après la ligne) en mobile,
                    5/12 alterné en md+ */}
                <div className={cn(
                  "ml-12 w-[calc(100%-3rem)] p-6 bg-card rounded-lg border shadow-xs",
                  "md:ml-0 md:w-5/12",
                  onLeft ? "md:mr-auto" : "md:ml-auto"
                )}>
                  {(event.date) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDateLong(event.date)}</span>
                    </div>
                  )}

                  <T k={event.title} as="h3" className="text-xl font-bold text-foreground mb-3" />

                  <T k={event.text} as="p" className="text-muted-foreground leading-relaxed" />
                </div>

                {/* Timeline Dot : alignée sur la ligne (gauche en mobile, centre en md+) */}
                <div className="absolute left-4 md:left-1/2 -translate-x-1/2 w-4 h-4 bg-primary rounded-full border-4 border-background z-10" />
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
export default TimelineSection;
