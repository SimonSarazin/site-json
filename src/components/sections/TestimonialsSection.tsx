import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { T } from "@/components/ui/T";
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from '@/lib/utils';
import { TestimonialsSectionProps } from '@/types/site-schema';

function TestimonialCard({ item }: { item: TestimonialsSectionProps['items'][number] }) {
  const { t } = useLocalization();
  return (
    <Card className="h-full">
      <CardContent className="p-6">
        <div className="flex flex-col h-full">
          <Quote className="w-8 h-8 text-primary mb-4" />
          <blockquote className="text-lg leading-relaxed mb-6 flex-1 text-foreground">
            "<T k={item.quote} />"
          </blockquote>
          <div className="flex items-center gap-4">
            <Avatar>
              <AvatarImage src={item.avatar} alt={t(item.author)} />
              <AvatarFallback>
                {t(item.author).split(' ').map((n: string) => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <T k={item.author} as="div" className="font-semibold text-foreground" />
              {item.role && (
                <T k={item.role} as="div" className="text-sm text-muted-foreground" />
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TestimonialsSection({ id, props }: { id?: string; props: TestimonialsSectionProps }) {
  const { items, style = 'carousel', autoplay = true } = props;
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-advance carousel
  useEffect(() => {
    if (style === 'carousel' && autoplay && items.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % items.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [items.length, style, autoplay]);

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  return (
    <section id={id} className="py-16 bg-muted/30 text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {style === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item, index) => (
              <TestimonialCard key={index} item={item} />
            ))}
          </div>
        )}

        {style === 'carousel' && (
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              <TestimonialCard item={items[currentIndex]} />

              {items.length > 1 && (
                <div className="flex justify-center items-center gap-4 mt-8">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Témoignage précédent"
                    onClick={prevTestimonial}
                    className="w-10 h-10 p-0"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  <div className="flex gap-2">
                    {items.map((_, index) => (
                      <button
                        key={index}
                        aria-label={`Témoignage ${index + 1}`}
                        onClick={() => setCurrentIndex(index)}
                        className={cn(
                          "w-2 h-2 rounded-full transition-colors",
                          index === currentIndex ? "bg-primary" : "bg-muted-foreground/30"
                        )}
                      />
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Témoignage suivant"
                    onClick={nextTestimonial}
                    className="w-10 h-10 p-0"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {style === 'ticker' && (
          <div className="overflow-hidden">
            <div className="flex animate-marquee gap-6">
              {[...items, ...items].map((item, index) => (
                <div key={index} className="shrink-0 w-80">
                  <TestimonialCard item={item} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
export default TestimonialsSection;
