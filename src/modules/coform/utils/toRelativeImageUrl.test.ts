// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { toRelativeImageUrl } from "./toRelativeImageUrl";

describe("toRelativeImageUrl", () => {
  beforeEach(() => {
    // jsdom expose window.location.origin = "http://localhost:3000" par défaut.
    // Cf. https://github.com/jsdom/jsdom
  });

  describe("inputs vides", () => {
    it("renvoie undefined pour undefined", () => {
      expect(toRelativeImageUrl(undefined)).toBeUndefined();
    });

    it("renvoie undefined pour empty string (falsy)", () => {
      expect(toRelativeImageUrl("")).toBeUndefined();
    });
  });

  describe("URL absolue → relative", () => {
    it("extrait pathname d'une URL https", () => {
      expect(toRelativeImageUrl("https://api.example.com/upload/avatar.jpg")).toBe(
        "/upload/avatar.jpg"
      );
    });

    it("extrait pathname d'une URL http", () => {
      expect(toRelativeImageUrl("http://api.example.com/img.png")).toBe("/img.png");
    });

    it("conserve les query params (?variant=medium etc.)", () => {
      expect(
        toRelativeImageUrl("https://api.example.com/img.jpg?variant=medium")
      ).toBe("/img.jpg?variant=medium");
    });

    it("conserve plusieurs query params", () => {
      expect(
        toRelativeImageUrl("https://api.example.com/img.jpg?size=md&v=2")
      ).toBe("/img.jpg?size=md&v=2");
    });

    it("ignore le hash (#)", () => {
      expect(toRelativeImageUrl("https://api.example.com/img.jpg#anchor")).toBe(
        "/img.jpg"
      );
    });

    it("ignore le port et l'auth de l'URL absolue", () => {
      expect(
        toRelativeImageUrl("https://user:pass@api.example.com:8080/img.jpg")
      ).toBe("/img.jpg");
    });

    it("conserve les caractères encodés du pathname", () => {
      expect(
        toRelativeImageUrl("https://api.example.com/upload/Mon%20Image.jpg")
      ).toBe("/upload/Mon%20Image.jpg");
    });
  });

  describe("URL déjà relative", () => {
    it("renvoie tel quel un path absolu (/...)", () => {
      expect(toRelativeImageUrl("/upload/avatar.jpg")).toBe("/upload/avatar.jpg");
    });

    it("conserve query params d'un path relatif", () => {
      expect(toRelativeImageUrl("/img.jpg?v=2")).toBe("/img.jpg?v=2");
    });

    it("préfixe avec / un path sans slash initial (résolu contre origin)", () => {
      // Comportement du constructeur URL : `new URL("img.jpg", "http://x/foo/bar")`
      // résout en "http://x/foo/img.jpg" → pathname devient "/img.jpg" en jsdom (origin=/).
      // Verifie juste que le résultat commence bien par "/".
      const result = toRelativeImageUrl("img.jpg");
      expect(result).toBeDefined();
      expect(result!.startsWith("/")).toBe(true);
    });
  });

  describe("cas tordus", () => {
    it("conserve les espaces déjà encodés dans search", () => {
      expect(
        toRelativeImageUrl("https://api.example.com/img.jpg?q=hello%20world")
      ).toBe("/img.jpg?q=hello%20world");
    });

    it("renvoie au moins quelque chose pour input non-vide même bizarre", () => {
      // L'objectif est de ne pas crash : retourne soit la transformation
      // soit l'input tel quel via le catch.
      const result = toRelativeImageUrl("not-an-url-but-not-empty");
      expect(result).toBeDefined();
    });
  });
});
