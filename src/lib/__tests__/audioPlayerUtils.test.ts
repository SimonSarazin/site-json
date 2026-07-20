import { describe, it, expect } from "vitest";
import {
  VITESSES_LECTURE,
  clamp,
  formaterTemps,
  calculerPourcentage,
  vitesseSuivante,
  formaterVitesse,
} from "../audioPlayerUtils";

describe("formaterTemps", () => {
  // ── Cas nominaux ──
  it("formate 0 seconde en 0:00", () => {
    expect(formaterTemps(0)).toBe("0:00");
  });

  it("formate moins d'une minute avec zéro de tête sur les secondes", () => {
    expect(formaterTemps(7)).toBe("0:07");
    expect(formaterTemps(59)).toBe("0:59");
  });

  it("formate entre une minute et une heure en m:ss", () => {
    expect(formaterTemps(60)).toBe("1:00");
    expect(formaterTemps(61)).toBe("1:01");
    expect(formaterTemps(599)).toBe("9:59");
    expect(formaterTemps(600)).toBe("10:00");
    expect(formaterTemps(3599)).toBe("59:59");
  });

  it("formate au-delà d'une heure en h:mm:ss", () => {
    expect(formaterTemps(3600)).toBe("1:00:00");
    expect(formaterTemps(3661)).toBe("1:01:01");
    expect(formaterTemps(7325)).toBe("2:02:05");
  });

  it("tronque les fractions de seconde", () => {
    expect(formaterTemps(12.7)).toBe("0:12");
  });

  // ── Valeurs invalides → fallback ──
  it("retombe sur 0:00 pour NaN", () => {
    expect(formaterTemps(NaN)).toBe("0:00");
  });

  it("retombe sur 0:00 pour Infinity", () => {
    expect(formaterTemps(Infinity)).toBe("0:00");
    expect(formaterTemps(-Infinity)).toBe("0:00");
  });

  it("retombe sur 0:00 pour une valeur négative", () => {
    expect(formaterTemps(-5)).toBe("0:00");
  });
});

describe("clamp", () => {
  it("laisse passer une valeur dans les bornes", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("borne aux extrémités", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it("retombe sur min pour une valeur non finie (position sûre pour le lecteur)", () => {
    expect(clamp(NaN, 0, 10)).toBe(0);
    expect(clamp(Infinity, 0, 10)).toBe(0);
    expect(clamp(-Infinity, 2, 10)).toBe(2);
  });
});

describe("calculerPourcentage", () => {
  it("calcule le pourcentage de progression", () => {
    expect(calculerPourcentage(0, 100)).toBe(0);
    expect(calculerPourcentage(50, 200)).toBe(25);
    expect(calculerPourcentage(100, 100)).toBe(100);
  });

  it("borne le résultat entre 0 et 100", () => {
    expect(calculerPourcentage(150, 100)).toBe(100);
    expect(calculerPourcentage(-5, 100)).toBe(0);
  });

  it("renvoie 0 quand la durée est invalide ou inconnue", () => {
    expect(calculerPourcentage(10, 0)).toBe(0);
    expect(calculerPourcentage(10, -1)).toBe(0);
    expect(calculerPourcentage(10, NaN)).toBe(0);
    expect(calculerPourcentage(10, Infinity)).toBe(0);
  });

  it("renvoie 0 quand le temps courant est NaN", () => {
    expect(calculerPourcentage(NaN, 100)).toBe(0);
  });
});

describe("vitesseSuivante", () => {
  it("suit le cycle 1 → 1.25 → 1.5 → 2 → 1", () => {
    expect(vitesseSuivante(1)).toBe(1.25);
    expect(vitesseSuivante(1.25)).toBe(1.5);
    expect(vitesseSuivante(1.5)).toBe(2);
    expect(vitesseSuivante(2)).toBe(1);
  });

  it("repart sur 1× pour une vitesse hors liste", () => {
    expect(vitesseSuivante(0.75)).toBe(1);
    expect(vitesseSuivante(3)).toBe(1);
    expect(vitesseSuivante(NaN)).toBe(1);
  });

  it("boucle sur l'ensemble des vitesses proposées", () => {
    // Parcourt un cycle complet depuis 1× et vérifie le retour au point de départ.
    let vitesse: number = VITESSES_LECTURE[0];
    const parcours: number[] = [];
    for (let i = 0; i < VITESSES_LECTURE.length; i++) {
      vitesse = vitesseSuivante(vitesse);
      parcours.push(vitesse);
    }
    expect(parcours).toEqual([1.25, 1.5, 2, 1]);
  });
});

describe("formaterVitesse", () => {
  it("formate les vitesses entières et décimales", () => {
    expect(formaterVitesse(1)).toBe("1×");
    expect(formaterVitesse(1.25)).toBe("1.25×");
    expect(formaterVitesse(2)).toBe("2×");
  });
});
