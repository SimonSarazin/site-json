import { buildOptimizedUrl } from "@/lib/imageUtils";

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  quality?: number;
  format?: "webp" | "avif" | "jpeg" | "png" | "auto";
  priority?: boolean;
  sizes?: string;
  className?: string;
  title?: string;
  style?: React.CSSProperties;
  onError?: React.ReactEventHandler<HTMLImageElement>;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  quality = 80,
  format = "auto",
  priority = false,
  sizes,
  className,
  title,
  style,
  onError,
}: OptimizedImageProps) {
  // SVG and data URIs — render plain <img>
  const isBypass = !src || src.endsWith(".svg") || src.startsWith("data:") || src.startsWith("blob:");

  if (isBypass) {
    return (
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        title={title}
        style={style}
        onError={onError}
        loading={priority ? "eager" : "lazy"}
      />
    );
  }

  const optimizedSrc = buildOptimizedUrl(src, { w: width, h: height, q: quality, f: format });

  // srcSet 1x/2x (retina) dès qu'une dimension est fournie — `width` OU `height`, en
  // doublant celle(s) présente(s). Permet les logos contraints par la hauteur (h-N w-auto,
  // ratio libre) sans imposer une largeur fixe qui écraserait les logos horizontaux.
  let srcSet: string | undefined;
  if (width || height) {
    const src2x = buildOptimizedUrl(src, {
      w: width ? width * 2 : undefined,
      h: height ? height * 2 : undefined,
      q: quality,
      f: format,
    });
    srcSet = `${optimizedSrc} 1x, ${src2x} 2x`;
  }

  return (
    <img
      src={optimizedSrc}
      srcSet={srcSet}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      className={className}
      title={title}
      style={style}
      onError={onError}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
    />
  );
}
