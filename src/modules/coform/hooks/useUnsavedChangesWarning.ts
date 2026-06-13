import { useEffect } from "react";

/**
 * Affiche la boîte de dialogue native du navigateur avant fermeture/refresh
 * quand des modifications non sauvegardées existent.
 *
 * Les navigateurs modernes ignorent le message personnalisé et affichent leur propre
 * texte générique ; seul le fait de s'abonner à l'événement suffit à déclencher le prompt.
 */
export function useUnsavedChangesWarning(isDirty: boolean, enabled: boolean = true): void {
  useEffect(() => {
    if (!enabled || !isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, enabled]);
}
