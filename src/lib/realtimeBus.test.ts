import { describe, it, expect, beforeEach } from "vitest";
import {
  _reinitialiserBus, abonnerResync, abonnerSujet, diffuserResync, diffuserSujet,
  lireCompteur, lireEtat, lireEtatServeur, lireCompteurServeur, poserEtat,
  souscrireCompteur, souscrireEtat,
} from "./realtimeBus";

/**
 * LE BUS, éprouvé sur l'invariant qui justifie son existence : **zéro abonné, zéro connexion**.
 *
 * Le cas nominal (« un sujet arrive, l'abonné est appelé ») n'est pas ce qui casse. Ce qui casse,
 * c'est la comptabilité des abonnés : un désabonnement compté deux fois ferait tomber le compteur
 * sous zéro et couperait le flux d'autres modules ; un désabonnement oublié le tiendrait ouvert
 * pour toujours. Ces deux fautes sont invisibles à l'œil et fatales en production.
 */

beforeEach(() => { _reinitialiserBus(); });

describe("la distribution", () => {
  it("livre un sujet à son abonné", () => {
    const vus: string[] = [];
    abonnerSujet("a", (t) => vus.push(t));
    diffuserSujet("a");
    expect(vus).toEqual(["a"]);
  });

  it("ne livre PAS un sujet à l'abonné d'un autre", () => {
    const vus: string[] = [];
    abonnerSujet("a", (t) => vus.push(t));
    diffuserSujet("b");
    expect(vus).toEqual([]);
  });

  it("livre à TOUS les abonnés d'un même sujet", () => {
    const vus: string[] = [];
    abonnerSujet("a", () => vus.push("un"));
    abonnerSujet("a", () => vus.push("deux"));
    diffuserSujet("a");
    expect(vus).toEqual(["un", "deux"]);
  });

  it("encaisse un sujet sans abonné", () => {
    expect(() => diffuserSujet("personne")).not.toThrow();
  });

  it("encaisse un désabonnement PENDANT la diffusion", () => {
    // Sans la copie du jeu d'abonnés, l'itération serait tronquée et le second jamais appelé.
    const vus: string[] = [];
    const couper = abonnerSujet("a", () => { vus.push("un"); couper(); });
    abonnerSujet("a", () => vus.push("deux"));
    diffuserSujet("a");
    expect(vus).toEqual(["un", "deux"]);
  });

  it("diffuse la resynchronisation avec son motif", () => {
    const motifs: string[] = [];
    abonnerResync((m) => motifs.push(m));
    diffuserResync("bus retabli");
    expect(motifs).toEqual(["bus retabli"]);
  });
});

describe("le compteur d'abonnés — l'invariant « zéro abonné, zéro connexion »", () => {
  it("part de zéro", () => {
    expect(lireCompteur()).toBe(0);
  });

  it("monte puis redescend exactement", () => {
    const a = abonnerSujet("x", () => {});
    const b = abonnerSujet("y", () => {});
    const c = abonnerResync(() => {});
    expect(lireCompteur()).toBe(3);
    a(); b(); c();
    expect(lireCompteur()).toBe(0);
  });

  it("ne décompte PAS deux fois un désabonnement répété", () => {
    // Le piège : React peut rejouer un nettoyage. Un double décompte passerait sous zéro et
    // fermerait le flux au nez des autres modules.
    const a = abonnerSujet("x", () => {});
    abonnerSujet("y", () => {});
    a(); a(); a();
    expect(lireCompteur()).toBe(1);
  });

  it("oublie le sujet quand son dernier abonné part", () => {
    const a = abonnerSujet("x", () => {});
    a();
    // Plus d'entrée : une diffusion ne doit toucher personne, et le compteur rester à zéro.
    const vus: string[] = [];
    abonnerSujet("z", (t) => vus.push(t));
    diffuserSujet("x");
    expect(vus).toEqual([]);
    expect(lireCompteur()).toBe(1);
  });

  it("prévient ses observateurs à chaque variation", () => {
    let reveils = 0;
    const stop = souscrireCompteur(() => { reveils += 1; });
    const a = abonnerSujet("x", () => {});
    a();
    stop();
    abonnerSujet("y", () => {});
    expect(reveils).toBe(2);           // +1 à l'abonnement, +1 au départ ; rien après `stop`
  });
});

describe("l'état", () => {
  it("part inactif et retient ce qu'on lui pose", () => {
    expect(lireEtat()).toBe("inactif");
    poserEtat("connecte");
    expect(lireEtat()).toBe("connecte");
  });

  it("ne réveille PAS ses observateurs pour un état identique", () => {
    // Sinon chaque battement du hub re-rendrait tous les abonnés pour rien.
    poserEtat("connecte");
    let reveils = 0;
    souscrireEtat(() => { reveils += 1; });
    poserEtat("connecte");
    expect(reveils).toBe(0);
    poserEtat("degrade");
    expect(reveils).toBe(1);
  });

  it("rend un instantané serveur neutre", () => {
    // Sans lui, `useSyncExternalStore` lève en SSR ; avec une autre valeur, il divergerait.
    expect(lireCompteurServeur()).toBe(0);
    expect(lireEtatServeur()).toBe("inactif");
  });
});
