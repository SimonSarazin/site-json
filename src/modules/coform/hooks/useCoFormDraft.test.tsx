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

  /**
   * Le dépôt d'un commun ouvre UNE étape extraite (`stepKey`), pas le parcours
   * complet. Le brouillon y était purement et simplement désactivé, faute de
   * pouvoir distinguer les deux périmètres : un brouillon d'étape restauré dans
   * le parcours complet aurait remplacé toutes les étapes par cette seule-là.
   */
  it("scope la clé par PÉRIMÈTRE : une étape seule ne partage rien avec le parcours complet", () => {
    const { result, unmount } = renderHook(() =>
      useCoFormDraft(options({ scope: "aapStep1" })),
    );
    act(() => result.current.saveDraft(PAYLOAD));
    act(() => void vi.advanceTimersByTime(500));
    act(() => unmount());
    expect(lire("coform-draft:v1:form-1:user-1:new:aapStep1")).not.toBeNull();
    expect(lire(CLE)).toBeNull();
  });

  /**
   * Le segment de périmètre n'est ajouté QUE s'il y en a un : sans cette
   * précaution, changer la fonction de clé aurait rendu orphelin tout brouillon
   * déjà enregistré par un utilisateur.
   */
  it.each([[undefined], [null], [""], ["   "]])(
    "sans périmètre (%s), la clé reste EXACTEMENT celle d'avant",
    (scope) => {
      const { result, unmount } = renderHook(() =>
        useCoFormDraft(options({ scope: scope as string | null | undefined })),
      );
      act(() => result.current.saveDraft(PAYLOAD));
      act(() => void vi.advanceTimersByTime(500));
      act(() => unmount());
      expect(lire(CLE)).not.toBeNull();
    },
  );

  it("un brouillon d'étape ne se restaure PAS dans le parcours complet", () => {
    window.localStorage.setItem(
      "coform-draft:v1:form-1:user-1:new:aapStep1",
      JSON.stringify({
        version: 1,
        data: { aapStep1: { titre: "saisi au dépôt" } },
        currentStepIndex: 0,
        completedSteps: [],
        addedOptions: {},
        timestamp: Date.now() - 60_000,
        baseUpdatedAt: null,
      }),
    );
    // Le parcours complet lit sa propre clé : il ne doit rien voir.
    const { result } = renderHook(() => useCoFormDraft(options()));
    expect(result.current.restorableDraft).toBeNull();
  });

  /**
   * Séquence vécue : ouvrir la modale, saisir, fermer (brouillon écrit) ;
   * rouvrir, cliquer « Reprendre », refermer SANS rien toucher — et le brouillon
   * avait disparu.
   *
   * La restauration appelait `discardDraft()` en comptant sur l'auto-save pour
   * réécrire dans la foulée. Sur le chemin single-step il est gardé par
   * `isDirty`, qui vaut `false` quand le seul geste a été de cliquer
   * « Reprendre » : plus rien n'était réécrit, et l'entrée venait d'être
   * supprimée. Reprendre un brouillon ne doit RIEN effacer.
   */
  it("reprendre un brouillon masque la bannière mais ne l'efface PAS", () => {
    poserBrouillon(Date.now() - 60_000);
    const { result } = renderHook(() => useCoFormDraft(options()));
    expect(result.current.restorableDraft).not.toBeNull();

    act(() => result.current.acknowledgeRestored());

    // La bannière ne revient pas…
    expect(result.current.restorableDraft).toBeNull();
    // …mais la saisie est toujours là : refermer maintenant ne perd rien.
    expect(lire()).not.toBeNull();
  });

  it("rejeter un brouillon, LUI, l'efface bien", () => {
    poserBrouillon(Date.now() - 60_000);
    const { result } = renderHook(() => useCoFormDraft(options()));
    act(() => result.current.discardDraft());
    expect(lire()).toBeNull();
  });

  /**
   * `purgeDraft` reconstruisait la clé « new » SANS le périmètre. Soumettre depuis
   * une étape extraite effaçait donc le brouillon de création du parcours complet
   * — la collision même que le segment interdit — tout en laissant traîner le sien,
   * d'où une bannière « Brouillon trouvé » sur un dépôt déjà soumis.
   */
  it("purger après soumission ne touche que le périmètre courant", () => {
    const autre = CLE; // …:new — le parcours complet
    const mien = "coform-draft:v1:form-1:user-1:new:aapStep1";
    for (const k of [autre, mien]) {
      window.localStorage.setItem(
        k,
        JSON.stringify({
          version: 1,
          data: {},
          currentStepIndex: 0,
          completedSteps: [],
          addedOptions: {},
          timestamp: Date.now() - 60_000,
          baseUpdatedAt: null,
        }),
      );
    }
    const { result } = renderHook(() =>
      useCoFormDraft(options({ answerId: "ans-9", scope: "aapStep1" })),
    );
    act(() => result.current.purgeDraft());

    expect(lire(mien)).toBeNull(); // le brouillon de création DE CE périmètre part
    expect(lire(autre)).not.toBeNull(); // celui du parcours complet est intact
  });

  /**
   * « Bannière masquée » vaut pour UNE clé. Si la clé change sans démontage —
   * `answerId`/`scope` qui arrivent en async, passage à une autre réponse — le
   * masquage d'avant ne veut plus rien dire, et laisserait invisible un brouillon
   * légitime.
   */
  it("changer de périmètre sans démonter réaffiche la bannière", () => {
    poserBrouillon(Date.now() - 60_000);
    window.localStorage.setItem(
      "coform-draft:v1:form-1:user-1:new:aapStep1",
      JSON.stringify({
        version: 1,
        data: {},
        currentStepIndex: 0,
        completedSteps: [],
        addedOptions: {},
        timestamp: Date.now() - 60_000,
        baseUpdatedAt: null,
      }),
    );
    const { result, rerender } = renderHook(
      ({ scope }: { scope?: string }) => useCoFormDraft(options({ scope })),
      { initialProps: {} as { scope?: string } },
    );
    act(() => result.current.acknowledgeRestored());
    expect(result.current.restorableDraft).toBeNull();

    rerender({ scope: "aapStep1" });
    expect(result.current.restorableDraft).not.toBeNull();
  });

  /**
   * Réécrire un brouillon repris ne doit pas effacer sa lignée de péremption :
   * `computeDraftState` n'ose déclarer un brouillon obsolète que si son
   * `baseUpdatedAt` est non nul. Le mettre à `null` le rendrait éternellement
   * restaurable — y compris par-dessus une réponse modifiée entre-temps.
   */
  it("réécrire un brouillon conserve la lignée qu'on lui passe", () => {
    const { result, unmount } = renderHook(() => useCoFormDraft(options()));
    act(() => result.current.saveDraft({ ...PAYLOAD, baseUpdatedAt: 1_700_000 }));
    act(() => void vi.advanceTimersByTime(500));
    act(() => unmount());
    expect(lire()?.baseUpdatedAt).toBe(1_700_000);
  });

  it("sans lignée explicite, on retombe sur celle du hook", () => {
    const { result, unmount } = renderHook(() =>
      useCoFormDraft(options({ baseUpdatedAt: 42 })),
    );
    act(() => result.current.saveDraft(PAYLOAD));
    act(() => void vi.advanceTimersByTime(500));
    act(() => unmount());
    expect(lire()?.baseUpdatedAt).toBe(42);
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
