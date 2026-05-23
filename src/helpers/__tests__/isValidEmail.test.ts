import { describe, it, expect } from "vitest";
import { isValidEmail } from "../isValidEmail";

describe("isValidEmail", () => {
  describe("emails valides", () => {
    it("accepte un email simple", () => {
      expect(isValidEmail("a@b.com")).toBe(true);
    });

    it("accepte un email avec point dans le local part", () => {
      expect(isValidEmail("first.last@example.com")).toBe(true);
    });

    it("accepte un email avec + tag", () => {
      expect(isValidEmail("user+tag@example.com")).toBe(true);
    });

    it("accepte un TLD multi-segment", () => {
      expect(isValidEmail("user@example.co.uk")).toBe(true);
    });

    it("accepte un sous-domaine", () => {
      expect(isValidEmail("user@mail.example.com")).toBe(true);
    });

    it("accepte des chiffres dans le local part et le domaine", () => {
      expect(isValidEmail("u123@d456.io")).toBe(true);
    });
  });

  describe("emails invalides", () => {
    it("rejette une chaîne vide", () => {
      expect(isValidEmail("")).toBe(false);
    });

    it("rejette une chaîne sans @", () => {
      expect(isValidEmail("abc")).toBe(false);
    });

    it("rejette un email sans local part", () => {
      expect(isValidEmail("@b.com")).toBe(false);
    });

    it("rejette un email sans domaine", () => {
      expect(isValidEmail("a@")).toBe(false);
    });

    it("rejette un email sans TLD (pas de point)", () => {
      expect(isValidEmail("a@b")).toBe(false);
    });

    it("rejette un email contenant un espace", () => {
      expect(isValidEmail("a b@c.com")).toBe(false);
      expect(isValidEmail("a@b c.com")).toBe(false);
    });

    it("rejette un double @", () => {
      expect(isValidEmail("a@@b.com")).toBe(false);
    });

    it("rejette un email avec juste un point (pas de TLD)", () => {
      expect(isValidEmail("a@b.")).toBe(false);
    });
  });
});
