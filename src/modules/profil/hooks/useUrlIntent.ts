import { useCallback } from "react";
import { useSearchParams } from "react-router";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useOptionalProfileEntity } from "./useProfileEntity";

/**
 * Intention portée par un paramètre d'URL — `?participer`, `?ajouter=event` — qu'un site tiers
 * (l'extension WordPress de tiers-lieux.org) pose pour envoyer le visiteur DIRECTEMENT sur une
 * action de la fiche, sans lui faire chercher dans les menus.
 *
 * Lecture PURE au rendu : le composant qui la consomme dérive son état « ouvert » de l'URL
 * (`etatLocal ?? intentionUrl`) au lieu de le poser dans un effet — `react-hooks/set-state-in-effect`
 * est en erreur dans ce dépôt. `clear()` retire le paramètre en `replace` (pas d'entrée d'historique) :
 * on l'appelle à la FERMETURE de ce qui a été ouvert, ce qui garantit une seule ouverture.
 */
export interface UrlIntent {
  /** Le paramètre est dans l'URL (avec ou sans valeur). */
  present: boolean;
  /** Sa valeur (`?ajouter=event` → `"event"`), `null` sans valeur ou sans paramètre. */
  value: string | null;
  /** Retire le paramètre de l'URL. Sans effet s'il n'y est plus. */
  clear: () => void;
}

export function useUrlIntent(param: string): UrlIntent {
  const [searchParams, setSearchParams] = useSearchParams();
  const present = searchParams.has(param);
  // `?participer` seul : `get` rend `""`, qu'on lit comme « pas de valeur ».
  const raw = searchParams.get(param);
  const value = raw === null || raw === "" ? null : raw;

  const clear = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(param);
        return next;
      },
      { replace: true },
    );
  }, [param, setSearchParams]);

  return { present, value, clear };
}

const AUCUNE: Omit<UrlIntent, "clear"> = { present: false, value: null };

/**
 * `useUrlIntent` restreint à l'entité DE LA PAGE de profil.
 *
 * Les boutons d'action (`EntityActionButtons`, `AddEntityDropdown`) sont des composants partagés :
 * les six en-têtes de profil et la section `profile-actions` les rendent, mais aussi l'aperçu
 * d'événement de l'agenda et de la recherche (`PreviewEvent`), qui peut lui-même vivre dans un
 * onglet de la fiche. Sans cette garde, `/agenda?participer` ouvrirait la confirmation sur le
 * premier aperçu déplié. L'entité est celle de la page quand c'est l'objet même que porte
 * `ProfileEntityContext` — c'est ce que les en-têtes reçoivent de `useProfileEntity()`.
 */
export function useProfilePageIntent(param: string, entity: EntityTypes | null): UrlIntent {
  const page = useOptionalProfileEntity();
  const intent = useUrlIntent(param);
  const isPageEntity = entity !== null && page !== null && (page.entity as unknown) === (entity as unknown);
  return isPageEntity ? intent : { ...AUCUNE, clear: intent.clear };
}
