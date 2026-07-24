import { OptimizedImage } from "site-forge";

// Hors app, le proxy /img?url=… n'existe pas : on n'utilise QUE des sources
// data-URI (bypass assumé du composant — même règle que les configs offline).
// Le composant rend alors un <img> simple avec width/height et loading lazy/eager.

const illustration = (fond: string, forme: string, accent: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">` +
      `<rect width="640" height="360" fill="${fond}"/>` +
      `<circle cx="520" cy="84" r="44" fill="${accent}"/>` +
      `<path d="M0 360 L180 190 L330 320 L460 220 L640 360 Z" fill="${forme}"/>` +
    `</svg>`
  );

export const ImageSimple = () => (
  <OptimizedImage
    src={illustration("#dbeafe", "#3b82f6", "#93c5fd")}
    alt="Atelier parent-enfant dans le jardin partagé"
    width={480}
    height={270}
    className="rounded-lg border"
  />
);

export const Prioritaire = () => (
  <figure className="w-fit">
    <OptimizedImage
      src={illustration("#dcfce7", "#16a34a", "#86efac")}
      alt="Visuel principal de la page d'accueil"
      width={480}
      height={270}
      priority
      className="rounded-lg shadow-md"
    />
    <figcaption className="mt-2 text-xs text-muted-foreground">
      priority : loading=eager + fetchPriority=high (image LCP)
    </figcaption>
  </figure>
);

export const Vignettes = () => (
  <div style={{ display: "flex", gap: 12 }}>
    <OptimizedImage
      src={illustration("#fef3c7", "#d97706", "#fcd34d")}
      alt="Vignette sortie nature"
      width={120}
      height={90}
      className="rounded-md object-cover"
    />
    <OptimizedImage
      src={illustration("#fce7f3", "#db2777", "#f9a8d4")}
      alt="Vignette fête du réseau"
      width={120}
      height={90}
      className="rounded-md object-cover"
    />
    <OptimizedImage
      src={illustration("#e0e7ff", "#4f46e5", "#a5b4fc")}
      alt="Vignette café des parents"
      width={90}
      height={90}
      className="rounded-full border-2 border-primary object-cover"
    />
  </div>
);
