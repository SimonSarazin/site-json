import { useEffect } from "react";

export interface ParsedBinding {
  mod: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
}

/**
 * Parse une notation type `"mod+k"` / `"mod+shift+p"`.
 * `mod` = Cmd (macOS) OU Ctrl (autres) — on ne distingue pas les deux.
 */
export function parseBinding(binding: string): ParsedBinding {
  const out: ParsedBinding = { mod: false, shift: false, alt: false, key: "" };
  for (const raw of binding.toLowerCase().split("+")) {
    const part = raw.trim();
    if (["mod", "cmd", "command", "ctrl", "control", "meta"].includes(part)) out.mod = true;
    else if (part === "shift") out.shift = true;
    else if (part === "alt" || part === "option") out.alt = true;
    else if (part) out.key = part;
  }
  return out;
}

/**
 * Écoute un raccourci clavier global. SSR-safe (effet client-only, garde
 * `typeof document`). `handler` doit être stable (mémoïsé par l'appelant).
 */
export function useGlobalShortcut(
  binding: string,
  handler: () => void,
  options: { enabled?: boolean } = {}
): void {
  const { enabled = true } = options;

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const parsed = parseBinding(binding);
    if (!parsed.key) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const modPressed = e.metaKey || e.ctrlKey;
      if (parsed.mod !== modPressed) return;
      if (parsed.shift !== e.shiftKey) return;
      if (parsed.alt !== e.altKey) return;
      if (e.key.toLowerCase() !== parsed.key) return;
      e.preventDefault();
      handler();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [binding, handler, enabled]);
}
