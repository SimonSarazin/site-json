import { useState, useEffect, useSyncExternalStore } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Pause, Play, Quote } from 'lucide-react';
import { T } from "@/components/ui/T";
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from '@/lib/utils';
import { TestimonialsSectionProps } from '@/types/site-schema';

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * `matchMedia` et `document.hidden` sont des sources EXTERNES : `useSyncExternalStore`
 * est la primitive prévue pour s'y abonner. Elle évite le `setState` synchrone dans un
 * effet — interdit ici par `react-hooks/set-state-in-effect` — et fournit un instantané
 * serveur explicite pour le SSR.
 *
 * ⚠ `subscribe` et `getSnapshot` sont au niveau MODULE, pas dans le corps du hook :
 * React compare `subscribe` par IDENTITÉ et se désabonne/réabonne dès qu'elle change.
 * Définies dans le composant, elles seraient neuves à chaque rendu — donc un
 * removeEventListener + addEventListener toutes les 5 s pendant la rotation, ce qui est
 * exactement ce que cette primitive existe pour éviter.
 */
const mediaQuery = () => (typeof window === "undefined" ? null : window.matchMedia?.(REDUCED_MOTION) ?? null);

function subscribeReducedMotion(onChange: () => void) {
  const mq = mediaQuery();
  if (!mq) return () => {};
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const getReducedMotion = () => mediaQuery()?.matches ?? false;

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}
const getDocumentHidden = () => document.hidden;
const getFalse = () => false;

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
  /**
   * Suspension TRANSITOIRE, non mémorisée. Deux sources DISTINCTES : sinon sortir au
   * clavier (`blur`) relancerait la rotation alors que le pointeur est encore sur la
   * carte, et inversement.
   */
  const [pointerOver, setPointerOver] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  /** Arrêt EXPLICITE par l'utilisateur (bouton). Distinct du précédent : il persiste. */
  const [userPaused, setUserPaused] = useState(false);
  /**
   * La garde `prefers-reduced-motion` de `shared.css` ne cible que 5 classes d'animation
   * maison — elle ne peut RIEN contre un `setInterval`. D'où cette garde JS.
   */
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, getFalse);
  /** Onglet en arrière-plan : inutile de faire tourner ce que personne ne voit. */
  const documentHidden = useSyncExternalStore(subscribeVisibility, getDocumentHidden, getFalse);

  // Auto-advance carousel
  const canRotate = style === 'carousel' && autoplay && items.length > 1 && !reducedMotion;
  const rotating = canRotate && !pointerOver && !focusWithin && !userPaused && !documentHidden;
  useEffect(() => {
    if (!rotating) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [rotating, items.length]);

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
            {/* WCAG 2.2.2 « Pause, Stop, Hide » : bouton d'arrêt explicite (premier dans
                l'ordre de tabulation, comme l'exige l'APG), plus une suspension
                transitoire au survol et au focus clavier.

                ⚠ La suspension transitoire ne couvre QUE le contenu, pas la barre de
                contrôles : englober le bouton d'arrêt rendait « Reprendre » inopérant —
                le bouton gardant le focus, la rotation restait suspendue alors que le
                libellé annonçait l'inverse. */}
            <div className="relative">
              <div
                onMouseEnter={() => setPointerOver(true)}
                onMouseLeave={() => setPointerOver(false)}
                onFocusCapture={() => setFocusWithin(true)}
                onBlurCapture={() => setFocusWithin(false)}
              >
                <TestimonialCard item={items[currentIndex]} />
              </div>

              {items.length > 1 && (
                <div className="flex justify-center items-center gap-4 mt-8">
                  {canRotate && (
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={userPaused ? "Reprendre le défilement" : "Arrêter le défilement"}
                      onClick={() => setUserPaused((v) => !v)}
                      className="w-10 h-10 p-0"
                    >
                      {userPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </Button>
                  )}

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
                        type="button"
                        aria-label={`Témoignage ${index + 1} sur ${items.length}`}
                        aria-current={index === currentIndex ? "true" : undefined}
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
