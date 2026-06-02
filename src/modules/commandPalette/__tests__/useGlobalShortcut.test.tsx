// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { parseBinding, useGlobalShortcut } from "../hooks/useGlobalShortcut";

describe("parseBinding", () => {
  it("parse mod+k", () => {
    expect(parseBinding("mod+k")).toEqual({ mod: true, shift: false, alt: false, key: "k" });
  });

  it("traite ctrl / cmd / meta comme `mod`", () => {
    expect(parseBinding("ctrl+p").mod).toBe(true);
    expect(parseBinding("cmd+p").mod).toBe(true);
    expect(parseBinding("meta+p").mod).toBe(true);
  });

  it("parse les modificateurs combinés", () => {
    expect(parseBinding("mod+shift+p")).toEqual({ mod: true, shift: true, alt: false, key: "p" });
  });
});

function press(init: Partial<KeyboardEventInit> & { key: string }) {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })
  );
}

describe("useGlobalShortcut", () => {
  it("déclenche le handler sur Meta+K", () => {
    const handler = vi.fn();
    renderHook(() => useGlobalShortcut("mod+k", handler, { enabled: true }));
    press({ key: "k", metaKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("déclenche aussi sur Ctrl+K (mod = Cmd OU Ctrl)", () => {
    const handler = vi.fn();
    renderHook(() => useGlobalShortcut("mod+k", handler, { enabled: true }));
    press({ key: "k", ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("ne déclenche pas sans modificateur", () => {
    const handler = vi.fn();
    renderHook(() => useGlobalShortcut("mod+k", handler, { enabled: true }));
    press({ key: "k" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("ne déclenche pas si désactivé", () => {
    const handler = vi.fn();
    renderHook(() => useGlobalShortcut("mod+k", handler, { enabled: false }));
    press({ key: "k", metaKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("ignore les events répétés", () => {
    const handler = vi.fn();
    renderHook(() => useGlobalShortcut("mod+k", handler, { enabled: true }));
    press({ key: "k", metaKey: true, repeat: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("appelle preventDefault sur match", () => {
    renderHook(() => useGlobalShortcut("mod+k", () => {}, { enabled: true }));
    const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true, cancelable: true });
    const spy = vi.spyOn(ev, "preventDefault");
    document.dispatchEvent(ev);
    expect(spy).toHaveBeenCalled();
  });

  it("retire le listener au démontage", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useGlobalShortcut("mod+k", handler, { enabled: true }));
    unmount();
    press({ key: "k", metaKey: true });
    expect(handler).not.toHaveBeenCalled();
  });
});
