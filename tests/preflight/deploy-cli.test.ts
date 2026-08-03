import { describe, expect, test } from "vitest";
import { analyserArgv, OPTIONS_A_VALEUR, OPTIONS_BOOLEENNES } from "../../scripts/lib/deploy-cli";

/**
 * Verrouille le parsing de `scripts/deploy.ts`.
 *
 * Le piège qu'il ferme : l'extraction naïve `argv.filter(a => !a.startsWith("--"))`
 * prenait les valeurs d'options pour des slugs — `--timeout 300` fabriquait un
 * slug « 300 », et tout orchestrateur passant des options se faisait piéger.
 */
describe("deploy-cli : analyserArgv", () => {
  test("les valeurs d'options ne deviennent pas des positionnels", () => {
    const cmd = analyserArgv(["push", "parent62", "--timeout", "300", "--yes"]);
    expect(cmd.commande).toBe("push");
    expect(cmd.positionnels).toEqual(["parent62"]);
    expect(cmd.valeur("--timeout")).toBe("300");
    expect(cmd.bool("--yes")).toBe(true);
  });

  test("--context et --ref, historiquement piégeux, sont sautés aussi", () => {
    const cmd = analyserArgv(["env", "--context", "prod", "institutBleu", "--ref", "origin/main"]);
    expect(cmd.commande).toBe("env");
    expect(cmd.positionnels).toEqual(["institutBleu"]);
    expect(cmd.valeur("--context")).toBe("prod");
    expect(cmd.valeur("--ref")).toBe("origin/main");
  });

  test("une option booléenne ne consomme pas de valeur", () => {
    const cmd = analyserArgv(["push", "--json", "parent62"]);
    expect(cmd.positionnels).toEqual(["parent62"]);
    expect(cmd.bool("--json")).toBe(true);
  });

  test("une option inconnue est rendue, pas ignorée en silence", () => {
    const cmd = analyserArgv(["env", "parent62", "--wirte"]);
    expect(cmd.inconnues).toEqual(["--wirte"]);
  });

  test("plusieurs positionnels (alias : slug + domaine) restent ordonnés", () => {
    const cmd = analyserArgv(["alias", "tiersLieux", "www.tiers-lieux.org", "--write"]);
    expect(cmd.commande).toBe("alias");
    expect(cmd.positionnels).toEqual(["tiersLieux", "www.tiers-lieux.org"]);
    expect(cmd.bool("--write")).toBe(true);
  });

  test("option à valeur sans valeur : signalée malformée, jamais traitée comme absente", () => {
    // `--context` avalé viserait en silence l'instance par défaut.
    expect(analyserArgv(["push", "--timeout"]).malformees).toEqual(["--timeout"]);
    const cmd = analyserArgv(["push", "--context", "--yes", "parent62"]);
    expect(cmd.malformees).toEqual(["--context"]);
    expect(cmd.valeur("--context")).toBeUndefined();
    expect(cmd.bool("--yes")).toBe(true);
    expect(cmd.positionnels).toEqual(["parent62"]);
  });

  test("aucun argument : tout est vide, rien ne lève", () => {
    const cmd = analyserArgv([]);
    expect(cmd.commande).toBeUndefined();
    expect(cmd.positionnels).toEqual([]);
    expect(cmd.inconnues).toEqual([]);
    expect(cmd.malformees).toEqual([]);
  });

  test("les deux jeux d'options sont disjoints", () => {
    for (const o of OPTIONS_A_VALEUR) expect(OPTIONS_BOOLEENNES.has(o)).toBe(false);
  });
});
