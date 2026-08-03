import { useEffect } from "react";
import { Toaster as SonnerToaster, toast } from "sonner";

// LIMITE (documentée dans learnings/wave2-U4.md) : `toast()` et `<Toaster>`
// communiquent par un store module-scope de sonner. Le bundle site-forge
// embarque SA copie de sonner (Toaster exporté), le preview bundle la SIENNE
// (pour `toast` — non ré-exporté par la barrel) → deux stores, aucune toast
// ne s'affiche si on mélange. On rend donc le wrapper src/components/ui/sonner.tsx
// À L'IDENTIQUE (className "toaster group" + les 3 variables --normal-* mappées
// sur les tokens popover/border, thème light par défaut) sur la copie preview :
// rendu visuel fidèle au composant réel.
//
// - duration: Infinity → les toasts survivent au délai de capture (auto-dismiss 4 s sinon).
// - Le <ol> sonner est position:fixed SANS portal → wrapper transform:translateZ(0)
//   = containing block : les toasts se posent dans la cellule (pattern CookieConsent v1).
// - Story unique : chaque Toaster monté affiche TOUTES les toasts du store.

export const Notifications = () => {
  useEffect(() => {
    toast.error("Impossible d'enregistrer : vérifiez votre connexion.", {
      duration: Infinity,
    });
    toast("Nouveau message de la Maison de la Petite Enfance.", {
      description: "« Bonjour, votre place est réservée pour samedi… »",
      duration: Infinity,
    });
    toast.success("Inscription confirmée à l'atelier portage du 21 juillet.", {
      duration: Infinity,
    });
  }, []);

  return (
    <div
      style={{
        position: "relative",
        transform: "translateZ(0)",
        height: 320,
        overflow: "hidden",
      }}
    >
      {/* Réplique exacte du wrapper Toaster de src/components/ui/sonner.tsx */}
      <SonnerToaster
        theme="light"
        className="toaster group"
        style={
          {
            "--normal-bg": "var(--popover)",
            "--normal-text": "var(--popover-foreground)",
            "--normal-border": "var(--border)",
          } as React.CSSProperties
        }
        position="bottom-right"
        expand
      />
    </div>
  );
};
