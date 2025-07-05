import { Calendar } from 'lucide-react';
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from '@/lib/utils';
import { TimelineSectionProps } from '@/types/site-schema';

export function TimelineSection({ id, props }: { id?: string; props: TimelineSectionProps }) {
  const { t } = useLocalization();
  const { events, alternating = true } = props;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <section id={id} className="py-16 bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-1/2 transform -translate-x-1/2 w-0.5 h-full bg-border" />

            {events.map((event, index) => (
              <div 
                key={index}
                className={cn(
                  "relative flex items-center mb-12 last:mb-0",
                  alternating && index % 2 === 0 ? "flex-row" : "flex-row-reverse"
                )}
              >
                {/* Content */}
                <div className={cn(
                  "w-5/12 p-6 bg-card rounded-lg border shadow-xs",
                  alternating && index % 2 === 0 ? "mr-auto" : "ml-auto"
                )}>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(event.date)}</span>
                  </div>
                  
                  <h3 className="text-xl font-bold text-foreground mb-3">
                    {t(event.title)}
                  </h3>
                  
                  <p className="text-muted-foreground leading-relaxed">
                    {t(event.text)}
                  </p>
                </div>

                {/* Timeline Dot */}
                <div className="absolute left-1/2 transform -translate-x-1/2 w-4 h-4 bg-primary rounded-full border-4 border-background z-10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}