/** Repli si `VITE_ROCKETCHAT_URL` est posée à une valeur non http(s) — même défaut que `getRocketChatUrl()`. */
const FALLBACK_URL = "https://chat.communecter.org";

/**
 * URL du chat de la plateforme — instance Rocket.Chat SÉPARÉE (`getRocketChatUrl()`,
 * `chat.communecter.org` par défaut), PAS un chemin sous `getServerUrl()` : `<serverUrl>/co2/
 * rocketchat` ouvre communecter (page wrapper), pas le chat lui-même — mesuré en navigateur,
 * 26/10/2026. Normalise un éventuel slash final (jamais de `//` en fin d'URL) et retombe sur
 * `FALLBACK_URL` si la variable d'env n'est pas une URL http(s) valide (l'env est posée par le
 * déployeur, pas une faille, mais une faute de frappe ne doit pas finir en `href` cassé dans le
 * DOM). Lien générique, pas de salon par costum (contrairement au Kanban).
 */
export function platformRocketChatUrl(rocketChatUrl: string): string {
  const trimmed = rocketChatUrl.replace(/\/+$/, "");
  try {
    const { protocol } = new URL(trimmed);
    if (protocol !== "http:" && protocol !== "https:") return FALLBACK_URL;
  } catch {
    return FALLBACK_URL;
  }
  return trimmed;
}
