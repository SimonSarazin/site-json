/**
 * URL du chat de la plateforme — instance Rocket.Chat SÉPARÉE (`getRocketChatUrl()`,
 * `chat.communecter.org` par défaut), PAS un chemin sous `getServerUrl()` : `<serverUrl>/co2/
 * rocketchat` ouvre communecter (page wrapper), pas le chat lui-même — mesuré en navigateur,
 * 26/10/2026. Normalise juste un éventuel slash final (jamais de `//` en fin d'URL). Lien
 * générique, pas de salon par costum (contrairement au Kanban).
 */
export function platformRocketChatUrl(rocketChatUrl: string): string {
  return rocketChatUrl.replace(/\/+$/, "");
}
