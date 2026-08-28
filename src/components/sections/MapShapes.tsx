import { useMemo } from "react";
import { useNavigate } from "react-router";

import SectionEmptyState from "@/components/sections/SectionEmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocalization } from "@/hooks/useLocalization";
import {
  cssColorToken,
  isLayerInteractive,
  shapeHref,
  shapeValue,
  useGeoShapes,
  type GeoShapeLayer,
} from "@/lib/geoShapes";
// Chemin DIRECT et non le barrel : `projectShapes` tire `d3-geo`, que le barrel ne doit pas
// exposer à la carte MapLibre (cf. commentaire dans lib/geoShapes/index.ts).
import { projectShapes, SHAPE_VIEW_WIDTH } from "@/lib/geoShapes/projectShapes";
import type { MapShapesProps } from "@/types/site-schema";

const BG_MAP: Record<string, string> = {
  card: "bg-card",
  muted: "bg-muted",
  primary: "bg-primary/10",
  secondary: "bg-secondary",
  accent: "bg-accent/10",
  transparent: "bg-transparent",
};

const DEFAULT_MAX_HEIGHT = 520;

/**
 * Peinture d'une couche, en VARIABLES CSS.
 *
 * Les jetons du thème (`primary`, `accent`…) sont posés tels quels en `var(--x)` : en SVG le
 * navigateur les résout lui-même et suit le mode clair/sombre sans qu'on relise quoi que ce soit —
 * contrairement à la carte, où `resolveThemeColor` doit convertir l'`oklch` en sRGB pour le WebGL.
 * Passer par des variables (et non des attributs `fill`/`stroke`) est ce qui permet à l'état de
 * survol d'être décrit une fois en CSS au lieu d'être recalculé par contour en JS.
 */
function paintVars(layer: GeoShapeLayer | undefined): React.CSSProperties {
  const style = layer?.style;
  const fillOpacity = style?.fillOpacity ?? 0.12;
  return {
    "--shape-fill": style?.fill === "none" ? "none" : cssColorToken(style?.fill, "var(--primary)"),
    "--shape-stroke": cssColorToken(style?.stroke ?? style?.fill, "var(--primary)"),
    "--shape-fill-opacity": fillOpacity,
    // Le survol ÉCLAIRCIT sans jamais saturer : un contour déjà opaque ne doit pas devenir un aplat.
    "--shape-fill-opacity-hover": Math.min(1, fillOpacity + 0.25),
    "--shape-stroke-width": style?.strokeWidth ?? 1.5,
    "--shape-stroke-opacity": style?.strokeOpacity ?? 0.9,
  } as React.CSSProperties;
}

const PATH_BASE =
  "[fill:var(--shape-fill)] [fill-opacity:var(--shape-fill-opacity)] [stroke:var(--shape-stroke)] " +
  "[stroke-width:var(--shape-stroke-width)] [stroke-opacity:var(--shape-stroke-opacity)] " +
  "[vector-effect:non-scaling-stroke]";

const PATH_INTERACTIVE =
  `${PATH_BASE} cursor-pointer transition-[fill-opacity] duration-150 motion-reduce:transition-none ` +
  "hover:[fill-opacity:var(--shape-fill-opacity-hover)]";

/** Halo de fond sous le libellé : sans lui un nom devient illisible sur un contour rempli. */
const LABEL_STYLE: React.CSSProperties = {
  fill: "var(--foreground)",
  stroke: "var(--background)",
  strokeWidth: 3,
  strokeLinejoin: "round",
  paintOrder: "stroke",
};

/**
 * Contours géographiques cliquables, rendus en SVG **hors carte**.
 *
 * Même donnée que `map.shapes` (mêmes endpoints, même cache 24 h, même `simplify`), mais montrée
 * comme un bloc de NAVIGATION : pas de fond de plan, pas de marqueurs, aucune requête de recherche.
 * Cliquer un territoire mène à `target.path?target.filterId=<valeur>` — le contrat de
 * `regionsTarget`, où c'est la page cible qui hydrate son filtre depuis l'URL.
 *
 * SSR : rien n'est gardé par `ClientOnly`. Le composant ne touche ni au DOM ni à `window`, et React
 * Query ne charge pas pendant le rendu serveur — le HTML porte donc le titre (indexable) et un
 * squelette, et le premier rendu client lui est identique.
 */
export default function MapShapes({ id, props }: { id?: string; props: MapShapesProps }) {
  const { t } = useLocalization();
  const navigate = useNavigate();
  const { title, description, bg, maxHeight = DEFAULT_MAX_HEIGHT, shapes: sources, target } = props;

  const layers = useGeoShapes(sources);
  const { shapes, labels, height } = useMemo(() => projectShapes(layers), [layers]);
  const layerById = useMemo(() => new Map(layers.map((layer) => [layer.id, layer])), [layers]);

  const isLoading = layers.some((layer) => layer.isLoading);
  const isError = layers.some((layer) => layer.isError);
  const legend = layers.filter((layer) => layer.label && layer.data.features.length > 0);
  const sectionBg = bg && bg !== "default" ? BG_MAP[bg] : "";

  return (
    <section id={id} className={`py-16 px-4 ${sectionBg}`}>
      <div className="container mx-auto">
        {title && (
          <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center">{t(title)}</h2>
        )}
        {description && (
          <p className="mt-3 text-muted-foreground text-center max-w-2xl mx-auto">{t(description)}</p>
        )}

        <div className={title || description ? "mt-8" : ""}>
          {shapes.length === 0 ? (
            // TROIS états distincts, et non deux : affirmer « aucun contour ici » alors qu'on n'a
            // RIEN PU LIRE tromperait sur le périmètre au lieu de signaler la panne.
            isLoading ? (
              <Skeleton className="w-full rounded-lg" style={{ height: maxHeight }} />
            ) : (
              <SectionEmptyState
                message={t(
                  isError
                    ? {
                        fr: "Les contours n'ont pas pu être chargés. Réessayez plus tard.",
                        en: "Boundaries could not be loaded. Please try again later.",
                      }
                    : {
                        fr: "Aucun contour à afficher pour ce périmètre.",
                        en: "No boundary to display for this area.",
                      },
                )}
              />
            )
          ) : (
            <svg
              viewBox={`0 0 ${SHAPE_VIEW_WIDTH} ${height}`}
              preserveAspectRatio="xMidYMid meet"
              className="w-full"
              style={{ maxHeight }}
              role="group"
              aria-label={title ? t(title) : undefined}
            >
              {shapes.map((shape) => {
                const layer = layerById.get(shape.layerId);
                const href = isLayerInteractive(shape.layerId, target)
                  ? shapeHref(shape.properties, target)
                  : null;
                // Beaucoup de documents legacy n'ont pas de `name` (`toFeatureCollection` pose
                // alors `null`). Sans repli, le lien serait focusable au clavier SANS AUCUN nom
                // accessible ; la valeur de filtre — celle-là même qui part dans l'URL — est le
                // seul libellé fidèle qui reste.
                const label = shape.name ?? shapeValue(shape.properties, target.valueFrom);

                // Un contour sans valeur de filtre reste du DÉCOR : un `<path>` inerte plutôt qu'un
                // lien mort. `<a>` dans un SVG rend un vrai SVGAElement — focusable au clavier et
                // ouvrable dans un nouvel onglet ; le handler ne fait que garder la nav SPA.
                if (!href) {
                  return (
                    <path
                      key={shape.key}
                      d={shape.d}
                      style={paintVars(layer)}
                      className={`${PATH_BASE} pointer-events-none`}
                    />
                  );
                }

                return (
                  <a
                    key={shape.key}
                    href={href}
                    aria-label={label ?? undefined}
                    className="outline-none focus-visible:[&>path]:[stroke-width:3]"
                    onClick={(event) => {
                      // Même garde que le `<Link>` de react-router : un `preventDefault`
                      // INCONDITIONNEL confisquerait ce que l'utilisateur a demandé au navigateur
                      // — Ctrl/Cmd + clic (nouvel onglet), Maj (nouvelle fenêtre), clic non
                      // primaire — et l'ancre SVG perdrait la seule chose qui la distingue d'un
                      // `<path>` avec un handler.
                      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                        return;
                      }
                      event.preventDefault();
                      navigate(href);
                    }}
                  >
                    {label && <title>{label}</title>}
                    <path d={shape.d} style={paintVars(layer)} className={PATH_INTERACTIVE} />
                  </a>
                );
              })}

              {/* Les libellés sont dans le repère du viewBox : ils rétrécissent avec lui, donc
                  illisibles sur un petit écran. On les réserve au-delà de `md`, la légende
                  ci-dessous restant, elle, toujours disponible. */}
              <g className="hidden md:block pointer-events-none">
                {labels.map((label) => (
                  <text
                    key={label.key}
                    x={label.x}
                    y={label.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={13}
                    fontWeight={600}
                    style={LABEL_STYLE}
                  >
                    {label.text}
                  </text>
                ))}
              </g>
            </svg>
          )}
        </div>

        {legend.length > 0 && (
          <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {legend.map((layer) => (
              <li key={layer.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  aria-hidden
                  className="h-3 w-3 shrink-0 rounded-[3px] border"
                  style={{
                    backgroundColor: cssColorToken(layer.style?.fill, "transparent"),
                    opacity: layer.style?.fill === "none" ? 1 : (layer.style?.fillOpacity ?? 0.12) + 0.35,
                    borderColor: cssColorToken(layer.style?.stroke ?? layer.style?.fill, "var(--border)"),
                  }}
                />
                {t(layer.label!)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
