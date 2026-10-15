import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Preflight — l'état SSR aux parents factorisés (`src/lib/ssrStatePacking.ts`) tient à DEUX
 * branchements que rien d'autre ne verrouille : l'emballage côté serveur, et la restitution côté
 * client AVANT tout lecteur. Un tri automatique des imports qui ferait passer
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
    expect(read("src/entry-server.tsx")).toMatch(/packSsrState\(dehydratedState\)/);
  });
});
