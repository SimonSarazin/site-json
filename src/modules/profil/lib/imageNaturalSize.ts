/** Dimensions réelles (en pixels) d'une image chargée depuis une URL — `data:` ou `blob:` compris. */
export function imageNaturalSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve({ width: image.naturalWidth, height: image.naturalHeight }));
    image.addEventListener("error", reject);
    image.src = url;
  });
}
