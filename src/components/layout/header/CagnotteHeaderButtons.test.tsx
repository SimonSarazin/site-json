// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";

/**
 * Les wrappers ne doivent charger le code cagnotte QUE lorsqu'ils sont rendus
 * côté client : ni à l'import du module (sinon le chunk du header l'embarque),
 * ni au SSR (la cagnotte est member-only, le serveur n'a rien à en rendre).
 *
 * Les fabriques `vi.mock` ne s'exécutent qu'au premier import du module mocké :
 * leur compteur dit exactement quand le code cagnotte a été chargé.
 */
const charge = vi.hoisted(() => ({ piggy: 0, pledge: 0 }));

vi.mock("@/modules/cagnotte/components/PiggyBankHeaderButton", () => {
  charge.piggy += 1;
  return { default: () => <button>PIGGY</button> };
});
vi.mock("@/modules/cagnotte/components/PledgeHeaderButton", () => {
  charge.pledge += 1;
  return { default: () => <button>PLEDGE</button> };
});

const { PiggyBankHeaderButton, PledgeHeaderButton } = await import("./CagnotteHeaderButtons");

describe("CagnotteHeaderButtons — wrappers lazy des boutons cagnotte", () => {
  it("importer le module des wrappers ne charge aucun des deux boutons", () => {
    expect(charge).toEqual({ piggy: 0, pledge: 0 });
  });

  it("au SSR, ne rend rien et ne déclenche pas l'import", () => {
    expect(renderToString(<PiggyBankHeaderButton />)).toBe("");
    expect(renderToString(<PledgeHeaderButton />)).toBe("");
    expect(charge).toEqual({ piggy: 0, pledge: 0 });
  });

  it("côté client, charge puis rend le bouton piggy-bank après hydratation", async () => {
    render(<PiggyBankHeaderButton />);
    expect(await screen.findByText("PIGGY")).toBeInTheDocument();
    expect(charge.piggy).toBe(1);
    // Rendre l'un ne charge pas l'autre.
    expect(charge.pledge).toBe(0);
  });

  it("côté client, charge puis rend le bouton des promesses après hydratation", async () => {
    render(<PledgeHeaderButton />);
    expect(await screen.findByText("PLEDGE")).toBeInTheDocument();
    expect(charge.pledge).toBe(1);
  });
});
