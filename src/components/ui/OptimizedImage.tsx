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

  // Build srcSet with 1x and 2x if width is provided
  let srcSet: string | undefined;
  if (width) {
    const src1x = optimizedSrc;
    const src2x = buildOptimizedUrl(src, { w: width * 2, h: height ? height * 2 : undefined, q: quality, f: format });
    srcSet = `${src1x} 1x, ${src2x} 2x`;
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
