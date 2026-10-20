/**
 * `lightenImage` : une image lourde est allégée avant envoi, sans jamais dégrader une image déjà légère ni
 * perdre l'image si la compression échoue. La compression canvas est injectée (jsdom n'a pas de canvas).
 */
import { describe, it, expect, vi } from "vitest";
import { fitWithin, lightenImage, LIGHT_IMAGE_BYTES, UPLOAD_COMPRESSION } from "./imageUtils";

const image = (octets: number, type = "image/jpeg") => new File([new Uint8Array(octets)], "photo", { type });
const lourde = () => image(8 * 1024 * 1024);

describe("lightenImage", () => {
  it("une image lourde part compressée, au réglage des images d'actualité", async () => {
    const allegee = image(600 * 1024);
    const compress = vi.fn().mockResolvedValue(allegee);

    expect(await lightenImage(lourde(), compress)).toBe(allegee);
    expect(compress).toHaveBeenCalledWith(expect.any(File), UPLOAD_COMPRESSION);
  });

  it("une image déjà légère part telle quelle, sans être ré-encodée", async () => {
    const legere = image(LIGHT_IMAGE_BYTES);
    const compress = vi.fn();

    expect(await lightenImage(legere, compress)).toBe(legere);
    expect(compress).not.toHaveBeenCalled();
  });

  it("un GIF n'est jamais compressé (le canvas lui ferait perdre son animation)", async () => {
    const gif = image(3 * 1024 * 1024, "image/gif");
    const compress = vi.fn();

    expect(await lightenImage(gif, compress)).toBe(gif);
    expect(compress).not.toHaveBeenCalled();
  });

  it("garde l'original si la version compressée n'est pas plus légère", async () => {
    const originale = lourde();
    const compress = vi.fn().mockResolvedValue(image(9 * 1024 * 1024));

    expect(await lightenImage(originale, compress)).toBe(originale);
  });

  it("garde l'original si la compression échoue", async () => {
    const originale = lourde();
    const compress = vi.fn().mockRejectedValue(new Error("Compression failed"));

    expect(await lightenImage(originale, compress)).toBe(originale);
  });
});

describe("fitWithin", () => {
  it("ramène le plus grand côté sous le plafond, proportions gardées, en px entiers", () => {
    expect(fitWithin(6875, 4544, 1920)).toEqual({ width: 1920, height: 1269 });
    expect(fitWithin(3000, 4000, 1920)).toEqual({ width: 1440, height: 1920 });
  });
  it("n'agrandit jamais", () => {
    expect(fitWithin(800, 400, 1920)).toEqual({ width: 800, height: 400 });
  });
});
