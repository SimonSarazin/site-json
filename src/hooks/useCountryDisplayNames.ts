import { useMemo } from "react";
import { useLocalization } from "@/hooks/useLocalization";

/**
 * Résolveur ISO-3166 alpha-2 → nom de pays localisé, via `Intl.DisplayNames`.
 *
 * POURQUOI un helper : le code pays est la SEULE clé fiable pour regrouper des
 * acteurs par pays. Les libellés libres saisis à côté (`address.level1Name`)
 * éclatent un même pays en plusieurs seaux — sur l'annuaire cyber-réunion,
 * `TZ` se scinde en « Tanzania »/« Tanzanie », `MG` en « Madagascar »/
 * « Madagasikara », `ZA` en « Afrique du Sud »/« Nanzfeih ». Les compteurs
 * affichés deviennent alors faux. On groupe donc sur l'ISO, et on ne se sert
 * du libellé que pour l'AFFICHAGE, résolu ici.
 *
 * Renvoie `null` quand `Intl.DisplayNames` est indisponible (environnements
 * anciens, certains runtimes SSR) : les appelants retombent alors sur le code.
 */
export function useCountryDisplayNames(): Intl.DisplayNames | null {
  const { currentLocale } = useLocalization();

  return useMemo(() => {
    if (typeof Intl === "undefined" || typeof Intl.DisplayNames === "undefined") {
      return null;
    }

    const supportedLocales = Intl.DisplayNames.supportedLocalesOf([currentLocale, "fr", "en"]);
    const localeToUse = supportedLocales[0] ?? "fr";
    return new Intl.DisplayNames([localeToUse], { type: "region" });
  }, [currentLocale]);
}

/**
 * Libellé affichable d'un code pays. Repli sur le code lui-même : mieux vaut
 * « MV » qu'une case vide si la locale n'expose pas la région.
 */
export function countryLabel(code: string, displayNames: Intl.DisplayNames | null): string {
  if (!code) return code;
  try {
    return displayNames?.of(code) ?? code;
  } catch {
    // `of()` jette sur un code mal formé (ex. libellé libre resté dans la donnée).
    return code;
  }
}
