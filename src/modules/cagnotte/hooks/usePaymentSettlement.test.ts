// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

/**
 * Ce qui est verrouillé ici :
 *  - un paiement enregistré déclenche le succès une fois, avec les données du clic ;
 *  - un paiement non enregistré se reprend par `cagnotteSettle`, sur la même facture ;
 *  - une reprise pendant un enregistrement en cours est signalée, sans perdre la référence.
 */

import { readSettlement, usePaymentSettlement } from "./usePaymentSettlement";

const SNAPSHOT = { amount: 50, method: "helloasso" };
const ECHEC = { bill: "b1", recorded: false, reference: "777", error: "depense not found" };
/** Réponse de `cagnotteSettle` quand un autre appel enregistre la facture. */
const EN_COURS = { success: 1, paid: false, recorded: false, inProgress: true, orderId: null, recordError: null };

function monter(reponses: Array<Record<string, unknown> | Error> = []) {
  const submit = vi.fn(async () => {
    const suivante = reponses.shift() ?? { success: 1, paid: true, recorded: true, orderId: "777" };
    if (suivante instanceof Error) throw suivante;
    return suivante;
  });
  const onRecorded = vi.fn();
  const { result } = renderHook(() => usePaymentSettlement({ submit, onRecorded }));
  return { result, submit, onRecorded };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("usePaymentSettlement", () => {
  it("enregistré : succès avec les données figées au clic", () => {
    const { result, onRecorded, submit } = monter();

    act(() => result.current.settled({ ...ECHEC, recorded: true, error: null }, SNAPSHOT));

    expect(result.current.status).toBe("done");
    expect(onRecorded).toHaveBeenCalledWith(SNAPSHOT, expect.objectContaining({ reference: "777" }));
    expect(submit).not.toHaveBeenCalled();
  });

  it("non enregistré : échec rejouable, sans succès annoncé", () => {
    const { result, onRecorded } = monter();

    act(() => result.current.settled(ECHEC, SNAPSHOT));

    expect(result.current.status).toBe("failed");
    expect(result.current.settlement).toEqual(ECHEC);
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it("« Réessayer » rejoue l'enregistrement de la même facture", async () => {
    const { result, submit, onRecorded } = monter();
    act(() => result.current.settled(ECHEC, SNAPSHOT));

    await act(async () => {
      await result.current.retry();
    });

    expect(submit).toHaveBeenCalledWith("cagnotteSettle", { bill: "b1" });
    expect(result.current.status).toBe("done");
    expect(onRecorded).toHaveBeenCalledWith(SNAPSHOT, expect.objectContaining({ bill: "b1", recorded: true }));
  });

  it("une reprise en erreur garde l'échec et affiche le message", async () => {
    const { result } = monter([new Error("Facture introuvable")]);
    act(() => result.current.settled(ECHEC, SNAPSHOT));

    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.status).toBe("failed");
    expect(result.current.settlement).toMatchObject({ bill: "b1", error: "Facture introuvable" });
  });

  it("reprise pendant un enregistrement en cours : signalée, avec la référence du paiement", async () => {
    const { result, onRecorded } = monter([EN_COURS, new Error("réseau")]);
    act(() => result.current.settled(ECHEC, SNAPSHOT));

    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.status).toBe("failed");
    expect(result.current.settlement).toMatchObject({ bill: "b1", reference: "777", inProgress: true, error: null });
    expect(onRecorded).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.settlement).toMatchObject({ inProgress: false, error: "réseau" });
  });
});

describe("readSettlement", () => {
  it("lit la réponse de `stripePay` : facture, enregistrement et intention Stripe", () => {
    expect(readSettlement({ success: 1, intent_id: "pi_1", bill: "b2", recorded: false, recordError: "x" })).toEqual({
      bill: "b2",
      recorded: false,
      reference: "pi_1",
      error: "x",
    });
  });

  it("lit la réponse de `cagnotteSettle`, qui ne rappelle pas la facture", () => {
    expect(readSettlement({ success: 1, paid: true, recorded: true, orderId: 98765 }, "b1")).toEqual({
      bill: "b1",
      recorded: true,
      reference: "98765",
      error: null,
    });
  });

  it("signale un enregistrement en cours", () => {
    expect(readSettlement(EN_COURS, "b1")).toEqual({
      bill: "b1",
      recorded: false,
      reference: null,
      error: null,
      inProgress: true,
    });
  });
});
