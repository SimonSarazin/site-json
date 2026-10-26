import { describe, it, expect } from "vitest";
import { initialesDe } from "./initiales";

/**
 * Les cas ci-dessous ne sont pas inventés : ce sont des noms RÉELS de la base de dev, relevés
 * en mesurant les 105 247 noms d'organisations, de projets, d'événements et de citoyens.
 */
describe("initialesDe", () => {
  it("prend la première lettre des deux premiers mots", () => {
    expect(initialesDe("Maison des parents")).toBe("MD");
    expect(initialesDe("Réseau petite enfance")).toBe("RP");
  });

  it("écarte les mots qui ne contiennent aucune lettre, au lieu de leur donner la place", () => {
    // Sans ce filtre, les deux premiers « mots » sont `//` et `Parallèle` → `/P`.
    expect(initialesDe("// Parallèle // RENNES")).toBe("PR");
    expect(initialesDe("SEOR - Société d'Études")).toBe("SS");
    expect(initialesDe('"" Le bonheur est dans le jardin""')).toBe("LB");
  });

  it("va chercher la première LETTRE du mot, et non son premier caractère", () => {
    expect(initialesDe("#NuitDebout compiegne")).toBe("NC");
    expect(initialesDe("4P")).toBe("P");
  });

  it("ne fait jamais d'un chiffre une initiale", () => {
    expect(initialesDe("CAUE 974")).toBe("C");
    expect(initialesDe("Colibris 67 Strasbourg")).toBe("CS");
    expect(initialesDe("Entente 429")).toBe("E");
  });

  it("rend « ? » plutôt qu'une pastille muette quand il ne reste rien", () => {
    expect(initialesDe("974")).toBe("?");
    expect(initialesDe("///")).toBe("?");
    expect(initialesDe("")).toBe("?");
    expect(initialesDe(null)).toBe("?");
    expect(initialesDe(undefined)).toBe("?");
    expect(initialesDe("   ")).toBe("?");
  });

  it("garde les lettres accentuées et les alphabets non latins", () => {
    expect(initialesDe("Émile Zola")).toBe("ÉZ");
    expect(initialesDe("Ökologie Zentrum")).toBe("ÖZ");
    expect(initialesDe("Ассоциация Развития")).toBe("АР");
  });

  it("ne coupe pas une paire de substitution quand un emoji ouvre le nom", () => {
    // `🌱` n'a aucune lettre : le mot entier est écarté, et non tronqué en demi-caractère.
    expect(initialesDe("🌱 Jardin partagé")).toBe("JP");
    expect(initialesDe("🌱🌿")).toBe("?");
  });

  it("respecte le nombre d'initiales demandé, et en rend toujours au moins une", () => {
    expect(initialesDe("Maison des parents", 1)).toBe("M");
    expect(initialesDe("Maison des parents", 3)).toBe("MDP");
    // Un `max` absurde ne doit pas rendre une chaîne vide.
    expect(initialesDe("Maison des parents", 0)).toBe("M");
  });

  it("tolère les espaces surnuméraires et les retours à la ligne", () => {
    expect(initialesDe("  Maison   des  parents ")).toBe("MD");
    expect(initialesDe("Maison\ndes parents")).toBe("MD");
  });
});
