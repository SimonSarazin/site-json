import { Key, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Clock, Users, ExternalLink } from 'lucide-react';
import { T } from "@/components/ui/T";
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from '@/lib/utils';
import { EventListSectionProps } from '@/types/site-schema';
import { OptimizedImage } from '@/components/ui/OptimizedImage';

export function EventListSection({ id, props }: { id?: string; props: EventListSectionProps }) {
  const { t } = useLocalization();
  const { events, layout = 'list', showPastEvents = false } = props;
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');

  const now = new Date();

  const filteredEvents = events.filter(event => {
    const eventDate = new Date(event.startDate);
    const isPast = eventDate < now;

    if (filter === 'upcoming') return !isPast;
    if (filter === 'past') return isPast;
    return true;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isEventPast = (dateString: string) => {
    return new Date(dateString) < now;
  };

  const EventCard = ({ event }: { event: EventListSectionProps['events'][number] }) => (
    <Card className={cn(
      "transition-all duration-200 hover:shadow-lg",
      isEventPast(event.startDate) && "opacity-75"
    )}>
      {event.image && (
        <div className="w-full h-48 overflow-hidden rounded-t-lg">
          <OptimizedImage
            src={event.image}
            alt={t(event.title)}
            width={400}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="text-xl text-foreground">
            <T k={event.title} />
          </CardTitle>
          {event.price && (
            <Badge variant="secondary" className="shrink-0">
              {event.price}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-muted-foreground leading-relaxed">
          <T k={event.description} />
        </p>

        {/* Event Details */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(event.startDate)}</span>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>
              {formatTime(event.startDate)}
              {event.endDate && ` - ${formatTime(event.endDate)}`}
            </span>
          </div>

          {event.location && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <T k={event.location} />
            </div>
          )}
        </div>

        {/* Tags */}
        {event.tags && event.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {event.tags.map((tag: Partial<Record<"fr" | "en" | "es" | "de", string>>, index: Key | null | undefined) => (
              <Badge key={index} variant="outline" className="text-xs">
                <T k={tag} />
              </Badge>
            ))}
          </div>
        )}

        {/* Registration Button */}
        {event.registrationUrl && !isEventPast(event.startDate) && (
          <Button asChild className="w-full">
            <a href={event.registrationUrl} target="_blank" rel="noopener noreferrer">
              <Users className="w-4 h-4 mr-2" />
              S'inscrire
              <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </Button>
        )}

        {isEventPast(event.startDate) && (
          <Badge variant="secondary" className="w-full justify-center">
            Événement passé
          </Badge>
        )}
      </CardContent>
    </Card>
  );

  return (
    <section id={id} className="py-16 bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Filter Buttons */}
          <div className="flex justify-center gap-2 mb-8">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
            >
              Tous les événements
            </Button>
            <Button
              variant={filter === 'upcoming' ? 'default' : 'outline'}
              onClick={() => setFilter('upcoming')}
            >
              À venir
            </Button>
            {showPastEvents && (
              <Button
                variant={filter === 'past' ? 'default' : 'outline'}
                onClick={() => setFilter('past')}
              >
                Passés
              </Button>
            )}
          </div>

          {/* Events Display */}
          {filteredEvents.length > 0 ? (
            <div className={cn(
              layout === 'grid' && "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",
              layout === 'list' && "space-y-6",
              layout === 'calendar' && "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            )}>
              {filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Aucun événement trouvé</h3>
              <p className="text-muted-foreground">
                {filter === 'upcoming' && "Aucun événement à venir pour le moment."}
                {filter === 'past' && "Aucun événement passé à afficher."}
                {filter === 'all' && "Aucun événement disponible."}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
export default EventListSection;
