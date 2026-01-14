import { useSyncExternalStore } from "react";
import cocolightApiClient from "@communecter/cocolight-api-client";

const { subscribeTo, isReactive } = cocolightApiClient;

/**
 * Hook personnalisé pour s'abonner à une propriété réactive d'un objet Proxy de cocolight.
 * Utilise useSyncExternalStore pour garantir l'absence de tearing en mode concurrent React
 * et synchroniser le système de réactivité natif de cocolight avec React.
 *
 * @param obj - L'objet réactif (Proxy)
 * @param key - La clé de la propriété à surveiller
 * @returns La valeur actuelle de la propriété
 *
 * @example
 * ```tsx
 * const commentCount = useReactiveProperty(item.serverData, 'commentCount');
 * return <span>({commentCount})</span>;
 * ```
 */
export function useReactiveProperty<T = unknown>(
  obj: Record<string, unknown> | null | undefined,
  key: string
): T | undefined {
  // Fonction de souscription : React appelle cette fonction pour s'abonner aux changements
  const subscribe = (onStoreChange: () => void) => {
    // Si l'objet n'est pas réactif, retourner une fonction de désabonnement vide
    if (!obj || !isReactive(obj)) {
      return () => {};
    }

    // S'abonner aux changements de la propriété via le système réactif de cocolight
    const unsubscribe = subscribeTo(obj, key, () => {
      // Notifier React qu'un changement a eu lieu
      onStoreChange();
    });

    // Retourner la fonction de désabonnement
    return typeof unsubscribe === "function" ? unsubscribe : () => {};
  };

  // Fonction snapshot : React appelle cette fonction pour obtenir la valeur actuelle
  const getSnapshot = (): T | undefined => {
    return obj?.[key] as T | undefined;
  };

  // Fonction snapshot serveur : utilisée pendant le SSR
  // Doit retourner la même valeur que getSnapshot pour éviter les hydration mismatches
  const getServerSnapshot = (): T | undefined => {
    return obj?.[key] as T | undefined;
  };

  // useSyncExternalStore gère automatiquement :
  // - L'appel initial à getSnapshot pour obtenir la valeur
  // - L'appel à subscribe pour s'abonner aux changements
  // - Le re-render quand onStoreChange est appelé
  // - L'appel à unsubscribe au démontage du composant
  // - La prévention du tearing en mode concurrent
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
