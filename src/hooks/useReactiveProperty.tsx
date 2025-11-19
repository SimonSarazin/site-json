import { useEffect, useState } from "react";
import cocolightApiClient from "@communecter/cocolight-api-client";

const { subscribeTo, isReactive } = cocolightApiClient;

/**
 * Hook personnalisé pour s'abonner à une propriété réactive d'un objet Proxy de cocolight.
 * Utilise le système de réactivité natif de la lib (subscribeTo) pour forcer un re-render
 * React quand la valeur de la propriété change.
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
  // Récupérer la valeur initiale
  const initialValue = obj?.[key] as T | undefined;
  const [value, setValue] = useState<T | undefined>(initialValue);

  useEffect(() => {
    // Vérifier que l'objet est réactif
    if (!obj || !isReactive(obj)) {
      // Si l'objet n'est pas réactif, utiliser la valeur directe
      setValue(obj?.[key] as T | undefined);
      return;
    }

    // S'abonner aux changements de la propriété via le système réactif de cocolight
    const unsubscribe = subscribeTo(obj, key, (newValue: T) => {
      setValue(newValue);
    });

    // Cleanup: se désabonner quand le composant démonte ou que les deps changent
    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [obj, key]);

  return value;
}
