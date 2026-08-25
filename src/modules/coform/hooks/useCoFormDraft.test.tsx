// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCoFormDraft } from "./useCoFormDraft";

/**
 * Le brouillon n'avait aucun test alors qu'il porte de la saisie utilisateur.
 *
 * Le cœur de ces tests est le **flush** : l'écriture est debouncée à 500 ms et
 * le démontage se contentait de l'ANNULER. Sur une page le démontage est rare
 * (précédé du warning « modifications non sauvegardées ») ; dans une modale, la
 * fermeture démonte immédiatement — donc tout ce qui avait été tapé dans la
 * dernière demi-seconde était perdu. C'est ce qui rendait le brouillon
 * inexploitable en modale.
 */

const CLE = "coform-draft:v1:form-1:user-1:new";

const PAYLOAD = {
  data: { step1: { titre: "Mon commun" } },
  currentStepIndex: 0,
  completedSteps: [],
  addedOptions: {},
} as unknown as Parameters<ReturnType<typeof useCoFormDraft>["saveDraft"]>[0];

function options(over: Partial<Parameters<typeof useCoFormDraft>[0]> = {}) {
  return { formId: "form-1", userId: "user-1", ...over };
}

function poserBrouillon(timestamp: number) {
  window.localStorage.setItem(
    CLE,
    JSON.stringify({
      version: 1,
      data: { step1: { titre: "repris" } },
      currentStepIndex: 0,
      completedSteps: [],
      addedOptions: {},
      timestamp,
      baseUpdatedAt: null,
    }),
  );
}

function lire(cle = CLE) {
  const brut = window.localStorage.getItem(cle);
  return brut ? JSON.parse(brut) : null;
}

describe("useCoFormDraft", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("écrit après le debounce, pas avant", () => {
    const { result } = renderHook(() => useCoFormDraft(options()));
    act(() => result.current.saveDraft(PAYLOAD));
    expect(lire()).toBeNull();
    act(() => void vi.advanceTimersByTime(500));
    expect(lire()?.data).toEqual({ step1: { titre: "Mon commun" } });
  });

  it("FLUSH au démontage — le cas nominal en modale", () => {
    const { result, unmount } = renderHook(() => useCoFormDraft(options()));
    act(() => result.current.saveDraft(PAYLOAD));
    // Rien n'est encore écrit : le debounce court toujours.
    expect(lire()).toBeNull();
    act(() => unmount());
    // Sans flush, la saisie était perdue ici.
    expect(lire()?.data).toEqual({ step1: { titre: "Mon commun" } });
  });

  it("FLUSH quand l'onglet passe en arrière-plan", () => {
    const { result } = renderHook(() => useCoFormDraft(options()));
    act(() => result.current.saveDraft(PAYLOAD));
    expect(lire()).toBeNull();
    act(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(lire()).not.toBeNull();
  });

  it("FLUSH à la fermeture de l'onglet (pagehide)", () => {
    const { result } = renderHook(() => useCoFormDraft(options()));
    act(() => result.current.saveDraft(PAYLOAD));
    act(() => void window.dispatchEvent(new Event("pagehide")));
    expect(lire()).not.toBeNull();
  });

  it("un discard n'est PAS ressuscité par le flush au démontage", () => {
    // Régression directe du flush : sans jeter le payload en attente, le
    // démontage réécrivait ce que l'utilisateur venait de supprimer.
    const { result, unmount } = renderHook(() => useCoFormDraft(options()));
    act(() => result.current.saveDraft(PAYLOAD));
    act(() => result.current.discardDraft());
    act(() => unmount());
    expect(lire()).toBeNull();
  });

  it("un purge (après soumission) n'est PAS ressuscité non plus", () => {
    const { result, unmount } = renderHook(() => useCoFormDraft(options()));
    act(() => result.current.saveDraft(PAYLOAD));
    act(() => result.current.purgeDraft());
    act(() => unmount());
    expect(lire()).toBeNull();
  });

  it("n'écrit rien quand il est désactivé", () => {
    const { result, unmount } = renderHook(() => useCoFormDraft(options({ disabled: true })));
    act(() => result.current.saveDraft(PAYLOAD));
    act(() => void vi.advanceTimersByTime(500));
    act(() => unmount());
    expect(window.localStorage.length).toBe(0);
  });

  it("n'écrit rien sans utilisateur — la clé est user-scopée", () => {
    const { result, unmount } = renderHook(() => useCoFormDraft(options({ userId: null })));
    act(() => result.current.saveDraft(PAYLOAD));
    act(() => void vi.advanceTimersByTime(500));
    act(() => unmount());
    expect(window.localStorage.length).toBe(0);
  });

  it("scope la clé par réponse : une création et une édition ne se mélangent pas", () => {
    const { result, unmount } = renderHook(() => useCoFormDraft(options({ answerId: "ans-9" })));
    act(() => result.current.saveDraft(PAYLOAD));
    act(() => void vi.advanceTimersByTime(500));
    act(() => unmount());
    expect(lire("coform-draft:v1:form-1:user-1:ans-9")).not.toBeNull();
    expect(lire(CLE)).toBeNull();
  });

  it("propose un brouillon ANTÉRIEUR à la session", () => {
    poserBrouillon(Date.now() - 60_000);
    const { result } = renderHook(() => useCoFormDraft(options()));
    expect(result.current.restorableDraft?.data).toEqual({ step1: { titre: "repris" } });
  });

  it("ne propose PAS un brouillon écrit pendant la session courante", () => {
    // Filtre délibéré : sans lui, la bannière « Brouillon trouvé » réapparaîtrait
    // à chaque sauvegarde automatique pendant la saisie.
    poserBrouillon(Date.now());
    const { result } = renderHook(() => useCoFormDraft(options()));
    expect(result.current.restorableDraft).toBeNull();
  });

  it("ignore et supprime un brouillon corrompu", () => {
    window.localStorage.setItem(CLE, '{"version":1,"data":"pas un objet"}');
    const { result } = renderHook(() => useCoFormDraft(options()));
    expect(result.current.restorableDraft).toBeNull();
    expect(window.localStorage.getItem(CLE)).toBeNull();
  });
});
