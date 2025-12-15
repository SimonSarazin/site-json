/**
 * Registre central des calculateurs de permissions
 * Les modules s'enregistrent ici via registerPermissions()
 */
import type { PermissionCalculator } from "./types";

/** Map des calculateurs enregistrés par namespace */
const calculators = new Map<string, PermissionCalculator>();

/**
 * Enregistre un calculateur de permissions pour un module
 *
 * @example
 * registerPermissions<ProfilPermissions>({
 *   namespace: "profil",
 *   calculate: (ctx) => calculateProfilPermissions(ctx),
 * });
 */
export function registerPermissions<T>(calculator: PermissionCalculator<T>): void {
  if (calculators.has(calculator.namespace)) {
    console.warn(
      `[permissions] Calculator "${calculator.namespace}" already registered, overwriting`
    );
  }
  calculators.set(calculator.namespace, calculator as PermissionCalculator);
}

/**
 * Récupère un calculateur par son namespace
 */
export function getCalculator(namespace: string): PermissionCalculator | undefined {
  return calculators.get(namespace);
}

/**
 * Récupère tous les calculateurs enregistrés
 */
export function getAllCalculators(): Map<string, PermissionCalculator> {
  return calculators;
}

/**
 * Vérifie si un namespace est enregistré
 */
export function hasCalculator(namespace: string): boolean {
  return calculators.has(namespace);
}
