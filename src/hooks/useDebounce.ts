import { useEffect, useState } from "react";

/**
 * Hook pour debouncer une valeur
 *
 * @param value - La valeur à debouncer
 * @param delay - Le délai en millisecondes (défaut: 500ms)
 * @returns La valeur debouncée
 *
 * @example
 * const [search, setSearch] = useState("");
 * const debouncedSearch = useDebounce(search, 500);
 *
 * useEffect(() => {
 *   // Cette fonction ne s'exécutera que 500ms après
 *   // que l'utilisateur a arrêté de taper
 *   fetchResults(debouncedSearch);
 * }, [debouncedSearch]);
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Mettre à jour la valeur debouncée après le délai
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Annuler le timeout si value change avant la fin du délai
    // (effet de debounce - on reset le timer à chaque changement)
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
