import { describe, expect, it } from "vitest";

import { extractCriticalImages } from "./extractCriticalResources";
import type { SiteConfig } from "@/types/site-schema";

const configWith = (props: Record<string, unknown>) =>
  ({ pages: [{ path: "/", sections: [{ type: "hero-search", props: { backgroundImage: "/img/hero.png", ...props } }] }] }) as unknown as SiteConfig;

describe("extractCriticalImages — hero-search", () => {
  it("précharge l'illustration en overlapNextSection (LCP du premier écran)", () => {
    expect(extractCriticalImages(configWith({ overlapNextSection: true }), "/")).toEqual([
      { src: "/img/hero.png", fetchpriority: "high", type: undefined, responsive: true },
    ]);
  });

  it("hors overlapNextSection, l'image reste décorative : aucun preload", () => {
    expect(extractCriticalImages(configWith({}), "/")).toEqual([]);
  });
});
