/**
 * Build an optimized image URL that goes through the /img middleware.
 * Bypasses SVGs and data URIs (returns src unchanged).
 */
export function buildOptimizedUrl(
  src: string,
  params: { w?: number; h?: number; q?: number; f?: string } = {},
): string {
  // Skip SVG and data URIs — no transformation needed
  if (!src || src.endsWith(".svg") || src.startsWith("data:") || src.startsWith("blob:")) {
    return src;
  }

  // Normalize relative paths to absolute so the middleware treats them as local
  let normalizedSrc = src;
  if (!src.startsWith("/") && !src.startsWith("http://") && !src.startsWith("https://")) {
    normalizedSrc = `/${src}`;
  }

  const searchParams = new URLSearchParams();
  searchParams.set("url", normalizedSrc);

  if (params.w) searchParams.set("w", String(params.w));
  if (params.h) searchParams.set("h", String(params.h));
  if (params.q) searchParams.set("q", String(params.q));
  if (params.f) searchParams.set("f", params.f);

  return `/img?${searchParams.toString()}`;
}
