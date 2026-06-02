import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useSite } from "@/hooks/useSite";
import { CommandPaletteContext } from "./CommandPaletteContext";
import { useGlobalShortcut } from "../hooks/useGlobalShortcut";
import { CommandPalette } from "../components/CommandPalette";
import "../i18n";

/**
 * Provider toujours monté (au niveau `SiteShell`, autour de `<Outlet />`).
 * Le raccourci clavier et le rendu de `<CommandPalette />` ne sont actifs que
 * si `config.commandPalette.enabled`. SSR-safe : `open` initial `false`, aucun
 * accès `window`/`document` au mount (le listener vit dans `useGlobalShortcut`).
 */
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const { config } = useSite();
  const enabled = config.commandPalette?.enabled ?? false;
  const keybinding = config.commandPalette?.keybinding ?? "mod+k";

  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  useGlobalShortcut(keybinding, toggle, { enabled });

  const value = useMemo(
    () => ({
      open,
      setOpen,
      openPalette: () => setOpen(true),
      closePalette: () => setOpen(false),
      enabled,
    }),
    [open, enabled]
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      {enabled && <CommandPalette />}
    </CommandPaletteContext.Provider>
  );
}
