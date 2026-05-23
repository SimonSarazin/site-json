// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createPageActionsState } from "../../pageState/createPageActionsState";

/**
 * Tests de createPageActionsState — factory de context React "actions" pour
 * partager du state + setters/actions composées entre sections d'une page.
 *
 * Couvre : Provider/use/useOptional, état initial, mutations via actions,
 * derived recomputé sur state change, helpers set/reset/get, référence
 * stable des actions, throw du hook strict hors Provider.
 */

describe("createPageActionsState", () => {
  // ── Construction de base ──
  describe("API exposée", () => {
    it("retourne Provider, use, useOptional, Context", () => {
      const result = createPageActionsState({
        name: "TestState",
        initialState: { count: 0 },
        actions: () => ({}),
      });
      expect(result.Provider).toBeDefined();
      expect(result.use).toBeInstanceOf(Function);
      expect(result.useOptional).toBeInstanceOf(Function);
      expect(result.Context).toBeDefined();
    });

    it("Context.displayName est préfixé avec le nom", () => {
      const result = createPageActionsState({
        name: "TestState",
        initialState: {},
        actions: () => ({}),
      });
      expect(result.Context.displayName).toBe("PageState(TestState)");
    });
  });

  // ── État initial ──
  describe("état initial", () => {
    it("expose l'état initial (valeur directe)", () => {
      const State = createPageActionsState({
        name: "S1",
        initialState: { count: 5, name: "hello" },
        actions: () => ({}),
      });
      const { result } = renderHook(() => State.use(), { wrapper: State.Provider });
      expect(result.current.state.count).toBe(5);
      expect(result.current.state.name).toBe("hello");
    });

    it("accepte initialState comme factory function", () => {
      const State = createPageActionsState({
        name: "S2",
        initialState: () => ({ count: 42 }),
        actions: () => ({}),
      });
      const { result } = renderHook(() => State.use(), { wrapper: State.Provider });
      expect(result.current.state.count).toBe(42);
    });
  });

  // ── Actions ──
  describe("actions", () => {
    it("setter (helpers.set) modifie l'état", () => {
      const State = createPageActionsState({
        name: "S3",
        initialState: { count: 0 },
        actions: ({ set }) => ({
          inc: () => set((s) => ({ ...s, count: s.count + 1 })),
        }),
      });
      const { result } = renderHook(() => State.use(), { wrapper: State.Provider });

      expect(result.current.state.count).toBe(0);
      act(() => {
        result.current.actions.inc();
      });
      expect(result.current.state.count).toBe(1);
      act(() => {
        result.current.actions.inc();
        result.current.actions.inc();
      });
      expect(result.current.state.count).toBe(3);
    });

    it("helpers.get lit l'état frais", () => {
      const State = createPageActionsState({
        name: "S4",
        initialState: { count: 0 },
        actions: ({ set, get }) => ({
          inc: () => set((s) => ({ ...s, count: s.count + 1 })),
          double: () => set((s) => ({ ...s, count: get().count * 2 })),
        }),
      });
      const { result } = renderHook(() => State.use(), { wrapper: State.Provider });

      act(() => {
        result.current.actions.inc();
        result.current.actions.inc();
        result.current.actions.inc();
      });
      expect(result.current.state.count).toBe(3);
      act(() => {
        result.current.actions.double();
      });
      expect(result.current.state.count).toBe(6);
    });

    it("helpers.reset remet l'état initial", () => {
      const State = createPageActionsState({
        name: "S5",
        initialState: { count: 0, name: "init" },
        actions: ({ set, reset }) => ({
          setName: (n: string) => set((s) => ({ ...s, name: n })),
          reset: () => reset(),
        }),
      });
      const { result } = renderHook(() => State.use(), { wrapper: State.Provider });

      act(() => {
        result.current.actions.setName("modified");
      });
      expect(result.current.state.name).toBe("modified");

      act(() => {
        result.current.actions.reset();
      });
      expect(result.current.state.name).toBe("init");
      expect(result.current.state.count).toBe(0);
    });

    it("référence stable de actions entre renders", () => {
      const State = createPageActionsState({
        name: "S6",
        initialState: { count: 0 },
        actions: ({ set }) => ({
          inc: () => set((s) => ({ ...s, count: s.count + 1 })),
        }),
      });
      const { result } = renderHook(() => State.use(), { wrapper: State.Provider });

      const firstActions = result.current.actions;
      act(() => {
        result.current.actions.inc();
      });
      expect(result.current.actions).toBe(firstActions);
    });
  });

  // ── Derived ──
  describe("derived", () => {
    it("recalcule derived quand state change", () => {
      const State = createPageActionsState({
        name: "S7",
        initialState: { items: [1, 2, 3] },
        actions: ({ set }) => ({
          add: (n: number) => set((s) => ({ ...s, items: [...s.items, n] })),
        }),
        derived: (s) => ({ count: s.items.length, sum: s.items.reduce((a, b) => a + b, 0) }),
      });
      const { result } = renderHook(() => State.use(), { wrapper: State.Provider });

      expect(result.current.state.count).toBe(3);
      expect(result.current.state.sum).toBe(6);

      act(() => {
        result.current.actions.add(4);
      });
      expect(result.current.state.count).toBe(4);
      expect(result.current.state.sum).toBe(10);
    });

    it("derived est mergé avec le state brut (les clés se chevauchent)", () => {
      const State = createPageActionsState({
        name: "S8",
        initialState: { items: [1, 2] as number[] },
        actions: () => ({}),
        derived: (s) => ({ count: s.items.length }),
      });
      const { result } = renderHook(() => State.use(), { wrapper: State.Provider });

      // state contient à la fois `items` (brut) et `count` (derived)
      expect(result.current.state.items).toEqual([1, 2]);
      expect(result.current.state.count).toBe(2);
    });

    it("derived absent → state ne contient que les champs bruts", () => {
      const State = createPageActionsState({
        name: "S9",
        initialState: { value: 1 },
        actions: () => ({}),
      });
      const { result } = renderHook(() => State.use(), { wrapper: State.Provider });
      expect(result.current.state.value).toBe(1);
    });
  });

  // ── Hooks strict / optional ──
  describe("hooks strict / optional", () => {
    it("use() throw hors Provider", () => {
      const State = createPageActionsState({
        name: "Strict",
        initialState: {},
        actions: () => ({}),
      });
      // renderHook sans wrapper → pas de Provider → throw
      expect(() => renderHook(() => State.use())).toThrow(
        /useStrict must be used inside <Strict.Provider>/
      );
    });

    it("useOptional() retourne null hors Provider", () => {
      const State = createPageActionsState({
        name: "Optional",
        initialState: {},
        actions: () => ({}),
      });
      const { result } = renderHook(() => State.useOptional());
      expect(result.current).toBeNull();
    });

    it("useOptional() retourne la valeur quand monté dans Provider", () => {
      const State = createPageActionsState({
        name: "Optional2",
        initialState: { v: 1 },
        actions: () => ({}),
      });
      const { result } = renderHook(() => State.useOptional(), {
        wrapper: State.Provider,
      });
      expect(result.current).not.toBeNull();
      expect(result.current?.state.v).toBe(1);
    });
  });
});
