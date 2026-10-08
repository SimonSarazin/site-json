import { describe, it, expect } from "vitest";
import { tooltipAnchorClass } from "./mapBubbleTooltip";

describe("tooltipAnchorClass", () => {
  it("bulle près du bord gauche : infobulle calée à gauche (sinon elle sort de la carte)", () => {
    expect(tooltipAnchorClass(6)).toBe("left-0");
    expect(tooltipAnchorClass(24.9)).toBe("left-0");
  });

  it("bulle près du bord droit : infobulle calée à droite", () => {
    expect(tooltipAnchorClass(75.1)).toBe("right-0");
    expect(tooltipAnchorClass(100)).toBe("right-0");
  });

  it("bulle au milieu : infobulle centrée", () => {
    expect(tooltipAnchorClass(25)).toBe("left-1/2 -translate-x-1/2");
    expect(tooltipAnchorClass(50)).toBe("left-1/2 -translate-x-1/2");
    expect(tooltipAnchorClass(75)).toBe("left-1/2 -translate-x-1/2");
  });
});
