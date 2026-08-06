import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocalization } from "@/hooks/useLocalization";
import { useDocumentHidden, useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";
import type { HeroCarouselProps } from "@/types/site-schema";
import { HeroBackgroundImage } from "./HeroBackgroundImage";

/** Repli de l'intervalle d'auto-avance. Voir le commentaire sur `autoplay` ci-dessous. */
const DEFAULT_INTERVAL_MS = 6000;

/**
 * Héro plein écran à diapositives.
 *
 * ── Socle CSS d'abord, JavaScript en amélioration ──
 * La piste est un conteneur `overflow-x-auto` + `snap-x snap-mandatory`, chaque
 * diapositive occupant `w-full shrink-0 snap-start`. Conséquence : SANS JavaScript —
 * pendant la fenêtre « HTML servi, React pas encore monté », qui se compte en secondes
 * sur ce dépôt — la diapositive 1 est visible ET le défilement tactile fonctionne déjà.
 * Un carrousel piloté par une librairie non hydratée, lui, est figé.
 *
 * `scroll-snap` est Baseline « largement disponible » depuis avril 2022. Les CSS
 * Carousels (`::scroll-marker`, `::scroll-button`) ne le sont PAS — Chromium seulement,
 * absents d'Interop 2026 — d'où des puces en vrai HTML, sérialisées par le serveur.
 *
 * ── Pourquoi pas `ui/carousel.tsx` (Embla) ──
 * Son `CarouselContent` est un cul-de-sac pour cet usage : le div porteur du `ref` est
 * écrit en dur `className="overflow-hidden"`, et `className`/`{...props}` partent tous
 * deux sur la piste flex INTERNE — impossible d'y poser `overflow-x` + `scroll-snap`
 * sans patcher un composant partagé, exporté vers le design-system et instancié 7 fois
 * ailleurs. Tailwind 4 fournit `snap-*` en cœur : zéro dépendance, zéro CSS maison.
 *
 * ── Chaîne LCP ── (les règles R1-R3 ; R4-R5 vivent dans extractCriticalResources.ts)
 * R1 · piste translatée, JAMAIS un empilement `absolute inset-0`. Empilées, les n
 *      diapositives seraient toutes dans le viewport : `lazy` deviendrait un no-op et n
 *      images plein écran partiraient en parallèle au premier paint.
 * R2 · `priority` sur la SEULE diapositive 0 → `loading="eager"` + `fetchpriority="high"`.
 * R3 · `lowPriority` sur les suivantes. Depuis Chrome 121 le défilement horizontal suit
 *      les mêmes seuils que le vertical : `lazy` n'économise plus rien à cette taille,
 *      seul `fetchpriority="low"` agit encore.
 * R6 · toutes les diapositives doivent avoir la MÊME taille intrinsèque, sinon le
 *      candidat LCP bascule sur la plus grande — donc, en auto-avance, sur une image
 *      affichée bien plus tard.
 */
export function HeroCarousel({ id, props }: { id?: string; props: HeroCarouselProps }) {
  const { t } = useLocalization();
  const slides = props.slides ?? [];

  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  /**
   * Suspensions TRANSITOIRES, non mémorisées, et volontairement DISTINCTES : sinon
   * sortir au clavier (`blur`) relancerait la rotation alors que le pointeur est encore
   * sur la scène, et inversement.
   */
  const [pointerOver, setPointerOver] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  /** Arrêt EXPLICITE (bouton). Distinct des précédents : il persiste. */
  const [userPaused, setUserPaused] = useState(false);

  const reducedMotion = useReducedMotion();
  const documentHidden = useDocumentHidden();

  /**
   * ⚠ La config n'est JAMAIS parsée par Zod à l'exécution : les `.optional()` du schéma
   * ne posent aucune valeur. Les replis DOIVENT donc être ici, dans le code.
   * `autoplay` est à `false` par défaut — décision de fond, pas de commodité : les
   * données de terrain montrent qu'un carrousel STATIQUE est cliqué deux fois plus
   * qu'un carrousel rotatif. C'est la rotation automatique qui détruit la valeur.
   */
  const autoplay = props.autoplay === true;
  const intervalMs = props.autoplayIntervalMs ?? DEFAULT_INTERVAL_MS;

  const canRotate = autoplay && slides.length > 1 && !reducedMotion;
  const rotating = canRotate && !pointerOver && !focusWithin && !userPaused && !documentHidden;

  /**
   * Défilement de la piste. `scrollTo` plutôt qu'un state de transform : c'est le
   * conteneur natif qui fait foi, si bien qu'un glissement tactile de l'utilisateur et
   * un clic sur une puce passent par le même chemin.
   */
  const goTo = useCallback((next: number) => {
    const track = trackRef.current;
    if (!track) return;
    const count = track.children.length;
    if (count === 0) return;
    const target = ((next % count) + count) % count;
    track.scrollTo({
      left: track.clientWidth * target,
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, []);

  /** L'index suit le DÉFILEMENT RÉEL, pas l'inverse — le glissement tactile compte donc. */
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const w = track.clientWidth;
        if (w > 0) setIndex(Math.round(track.scrollLeft / w));
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      track.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!rotating) return;
    const timer = setInterval(() => {
      const track = trackRef.current;
      if (!track || track.clientWidth === 0) return;
      goTo(Math.round(track.scrollLeft / track.clientWidth) + 1);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [rotating, intervalMs, goTo]);

  if (slides.length === 0) return null;

  const multiple = slides.length > 1;
  const regionLabel = props.ariaLabel
    ? t(props.ariaLabel)
    : t({ fr: "Carrousel de présentation", en: "Featured carousel" });

  return (
    <section
      id={id}
      className="relative min-h-screen overflow-hidden"
      aria-roledescription="carousel"
      aria-label={regionLabel}
    >
      {/*
        `aria-live` bascule "off" ↔ "polite" : pendant la rotation AUTOMATIQUE, annoncer
        chaque diapositive interromprait la lecture d'écran sans que personne ne l'ait
        demandé ; à l'arrêt, le changement résulte d'une action de l'utilisateur et doit
        donc être annoncé. `aria-atomic="false"` pour n'annoncer que ce qui change.
        (Contrat APG « Carousel ».)
      */}
      <div
        className="contents"
        aria-live={rotating ? "off" : "polite"}
        aria-atomic="false"
      >
        {/*
          R1 — la PISTE défile ; les diapositives sont côte à côte, jamais empilées.
          `scrollbar-hide` (utilitaire maison de shared.css) masque la barre sans
          retirer le défilement.
        */}
        <div
          ref={trackRef}
          className="flex h-screen w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden scrollbar-hide"
          onMouseEnter={() => setPointerOver(true)}
          onMouseLeave={() => setPointerOver(false)}
          onFocusCapture={() => setFocusWithin(true)}
          onBlurCapture={() => setFocusWithin(false)}
        >
          {slides.map((slide, i) => {
            const hasImage = Boolean(slide.backgroundImage);
            /*
              Encre conditionnelle — même règle que HeroTintedOverlay : l'image ET le
              voile sont optionnels, donc un blanc codé en dur donnerait du texte
              invisible sur un thème clair. Classes écrites en toutes lettres, une
              classe construite à l'exécution serait purgée du build de production.
            */
            const inkStrong = hasImage ? "text-white drop-shadow-lg" : "text-foreground";
            const ink = hasImage ? "text-white drop-shadow" : "text-foreground";

            return (
              <div
                key={i}
                role="group"
                aria-roledescription="slide"
                /* L'APG veut un nom INDEXÉ, pas un libellé constant. */
                aria-label={t({
                  fr: `Diapositive ${i + 1} sur ${slides.length}`,
                  en: `Slide ${i + 1} of ${slides.length}`,
                })}
                className="relative h-full w-full shrink-0 snap-start"
              >
                {slide.backgroundImage && (
                  <>
                    <HeroBackgroundImage
                      src={slide.backgroundImage}
                      alt={slide.backgroundImageAlt ? t(slide.backgroundImageAlt) : ""}
                      className="absolute inset-0 h-full w-full object-cover"
                      /* R2/R3 : une seule image prioritaire, les autres dépriorisées. */
                      priority={i === 0}
                      lowPriority={i !== 0}
                    />
                    <div className="absolute inset-0 bg-hero-tint" />
                  </>
                )}

                <div className="relative z-10 flex h-full flex-col items-center justify-center gap-6 px-4 text-center sm:gap-8">
                  {i === 0 && props.badge && (
                    <span className="rounded-full border border-border/60 bg-card/80 px-4 py-2 text-sm font-medium text-card-foreground shadow sm:px-6 sm:text-base">
                      {t(props.badge)}
                    </span>
                  )}

                  <h2
                    className={cn(
                      "text-3xl font-extrabold sm:text-5xl md:text-7xl",
                      inkStrong
                    )}
                  >
                    {t(slide.headline)}
                  </h2>

                  {slide.subhead && (
                    <p className={cn("max-w-3xl text-base font-light sm:text-lg md:text-2xl", ink)}>
                      {t(slide.subhead)}
                    </p>
                  )}

                  {slide.ctaLabel && (
                    <a
                      href={slide.ctaPath || "#"}
                      className="rounded-md border border-border/60 bg-card/80 px-6 py-2 text-base font-semibold text-card-foreground shadow transition-colors hover:bg-card sm:px-8 sm:py-3 sm:text-lg"
                    >
                      {t(slide.ctaLabel)}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {multiple && (
        /*
          Barre de contrôles — SŒUR de la piste, jamais son enfant : englobée dans la
          zone de survol/focus, le bouton « Reprendre » serait inopérant, puisqu'il
          garderait lui-même le focus et maintiendrait donc la suspension.
        */
        <div className="absolute inset-x-0 bottom-8 z-20 flex items-center justify-center gap-3">
          {/* WCAG 2.2.2 « Pause, Stop, Hide » : premier dans l'ordre de tabulation
              (exigence APG), libellé changeant, et surtout PAS d'`aria-pressed` —
              ce n'est pas une bascule d'état mais une action. */}
          {canRotate && (
            <Button
              variant="outline"
              size="sm"
              className="h-10 w-10 p-0"
              aria-label={
                userPaused
                  ? t({ fr: "Reprendre le défilement", en: "Start slide rotation" })
                  : t({ fr: "Arrêter le défilement", en: "Stop slide rotation" })
              }
              onClick={() => setUserPaused((v) => !v)}
            >
              {userPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-10 w-10 p-0"
            aria-label={t({ fr: "Diapositive précédente", en: "Previous slide" })}
            onClick={() => goTo(index - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={t({
                  fr: `Diapositive ${i + 1} sur ${slides.length}`,
                  en: `Slide ${i + 1} of ${slides.length}`,
                })}
                aria-current={i === index ? "true" : undefined}
                onClick={() => goTo(i)}
                className={cn(
                  "h-2.5 w-2.5 rounded-full transition-colors",
                  i === index ? "bg-primary" : "bg-card/60 ring-1 ring-border"
                )}
              />
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-10 w-10 p-0"
            aria-label={t({ fr: "Diapositive suivante", en: "Next slide" })}
            onClick={() => goTo(index + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Indicateur de défilement — le rebond est figé par le plancher
          `prefers-reduced-motion` de shared.css, qui nomme `.animate-bounce` ; le point
          pulsant est gardé sur place en `motion-safe:`, `animate-pulse` portant ailleurs
          l'information « ça charge ». Décalé quand la barre de contrôles est présente. */}
      {props.showScrollIndicator && (
        <div
          className={cn(
            "pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 animate-bounce",
            multiple ? "bottom-24" : "bottom-8"
          )}
        >
          <div className="flex h-10 w-6 items-start justify-center rounded-full border-2 border-white/50 p-2">
            <div className="h-3 w-1 rounded-full bg-white/70 motion-safe:animate-pulse" />
          </div>
        </div>
      )}
    </section>
  );
}

export default HeroCarousel;
