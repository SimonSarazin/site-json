import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Preflight — l'état SSR aux parents factorisés (`src/lib/ssrStatePacking.ts`) tient à DEUX
 * branchements que rien d'autre ne verrouille : l'emballage côté serveur (injecté tel quel par les
 * deux serveurs), et la restitution côté client AVANT tout lecteur. Un tri automatique des imports qui ferait passer
 * `ssrStateBootstrap` après un autre module laisserait des références `__ssrParentRef` à la place
 * des parents — sans casser aucun autre test.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf-8");

describe("Preflight — état SSR emballé / restitué", () => {
  test("entry-client importe ssrStateBootstrap EN PREMIER", () => {
    const firstImport = read("src/entry-client.tsx")
      .split("\n")
      .find((line) => line.startsWith("import "));
    expect(firstImport).toBe('import "@/lib/ssrStateBootstrap";');
  });

  test("entry-server emballe l'état transmis à onHead", () => {
    expect(read("src/entry-server.tsx")).toMatch(/serializeSsrState\(dehydratedState\)/);
  });

  // `serializeSsrState` rend un texte DÉJÀ échappé : re-sérialisé, il deviendrait une chaîne ; injecté
  // par un autre chemin (`JSON.stringify` nu), il perdrait l'échappement — la seule barrière XSS.
  test.each(["server/prod-server.js", "server/dev-server.js"])("%s injecte le texte de onHead tel quel", (file) => {
    const src = read(file);
    expect(src).toMatch(/window\.__REACT_QUERY_STATE__=\$\{stateJson\}/);
    expect(src).not.toMatch(/serialize\(\s*(dehydratedState|stateJson)/);
  });
});
