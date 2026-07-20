import { useEffect, useRef } from "react";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "site-forge";

/**
 * Radix ContextMenu n'a pas de prop `open` : on force l'ouverture en
 * dispatchant un vrai événement `contextmenu` sur la zone au montage
 * (capture statique — animations gelées par le provider).
 */
function useClicDroitAuto() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: r.left + 60,
        clientY: r.top + 50,
      })
    );
  }, []);
  return ref;
}

export const MenuFicheActeur = () => {
  const zone = useClicDroitAuto();
  return (
    <div style={{ padding: 32, minHeight: 380 }}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={zone}
            className="text-muted-foreground flex h-36 w-full max-w-md items-center justify-center rounded-md border border-dashed text-sm"
          >
            Fiche « La Ressourcerie » — clic droit pour les options
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem>
            Ouvrir la fiche
            <ContextMenuShortcut>⌘O</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>Partager…</ContextMenuItem>
          <ContextMenuCheckboxItem checked>
            Épingler sur la carte
          </ContextMenuCheckboxItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive">
            Signaler la fiche
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
};

export const TriAnnuaire = () => {
  const zone = useClicDroitAuto();
  return (
    <div style={{ padding: 32, minHeight: 380 }}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={zone}
            className="text-muted-foreground flex h-36 w-full max-w-md items-center justify-center rounded-md border border-dashed text-sm"
          >
            Liste de l&apos;annuaire — clic droit pour trier
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          <ContextMenuLabel>Trier l&apos;annuaire</ContextMenuLabel>
          <ContextMenuSeparator />
          <ContextMenuRadioGroup value="proximite">
            <ContextMenuRadioItem value="recent">
              Plus récents
            </ContextMenuRadioItem>
            <ContextMenuRadioItem value="alpha">
              Ordre alphabétique
            </ContextMenuRadioItem>
            <ContextMenuRadioItem value="proximite">
              Proximité
            </ContextMenuRadioItem>
          </ContextMenuRadioGroup>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
};
