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

  it("retombe sur le défaut si l'env n'est pas une URL valide (faute de frappe du déployeur)", () => {
    expect(platformRocketChatUrl("pas-une-url")).toBe("https://chat.communecter.org");
    expect(platformRocketChatUrl("")).toBe("https://chat.communecter.org");
  });

  it("retombe sur le défaut pour un schéma non http(s) (ex. javascript:)", () => {
    expect(platformRocketChatUrl("javascript:alert(1)")).toBe("https://chat.communecter.org");
  });
});
