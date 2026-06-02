import { useContext } from "react";
import {
  CommandPaletteContext,
  type CommandPaletteContextValue,
} from "../contexts/CommandPaletteContext";

/** Accès au contexte de la palette. Lève si hors `CommandPaletteProvider`. */
export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error("useCommandPalette must be used within a CommandPaletteProvider");
  }
  return ctx;
}

/** Variante non-throw : `null` hors provider (pour les boutons de header). */
export function useCommandPaletteOptional(): CommandPaletteContextValue | null {
  return useContext(CommandPaletteContext);
}
