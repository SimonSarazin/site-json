type ImageProps = {
  src: string;          // version JPEG/PNG fallback
  srcWebp?: string;     // optionnel : WebP
  srcAvif?: string;     // optionnel : AVIF
  alt: string;
  className?: string;
  width?: number;
  height?: number;
};

export function Image({
  src,
  srcWebp,
  srcAvif,
  alt,
  className,
  width,
  height,
}: ImageProps) {
  return (
    <picture>
      {srcAvif && <source type="image/avif" srcSet={srcAvif} />}
      {srcWebp && <source type="image/webp" srcSet={srcWebp} />}
      <img
        src={src}
        alt={alt}
        className={className}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
      />
    </picture>
  );
}
