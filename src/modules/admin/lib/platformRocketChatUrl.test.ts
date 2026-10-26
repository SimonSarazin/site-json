import { describe, it, expect } from "vitest";
import { platformRocketChatUrl } from "./platformRocketChatUrl";

describe("platformRocketChatUrl — URL du chat (instance Rocket.Chat séparée)", () => {
  it("retourne l'URL telle quelle (pas un chemin sous le serveur communecter)", () => {
    expect(platformRocketChatUrl("https://chat.communecter.org")).toBe(
      "https://chat.communecter.org",
    );
  });

  it("normalise les slashs finaux", () => {
    expect(platformRocketChatUrl("https://chat.communecter.org/")).toBe(
      "https://chat.communecter.org",
    );
    expect(platformRocketChatUrl("https://chat.communecter.org//")).toBe(
      "https://chat.communecter.org",
    );
  });
});
