import { createContext } from "react";

export interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  openPalette: () => void;
  closePalette: () => void;
  /** `true` si la palette est activée en config (`config.commandPalette.enabled`). */
  enabled: boolean;
}

export const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);
