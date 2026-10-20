/**
 * Déclenche le téléchargement navigateur d'un `Blob` (`createObjectURL` → `<a download>` → `revoke`)
 * — mécanique partagée par `downloadCsv.ts` (CSV, dupliqué 4× avant extraction) et l'export PDF de
 * l'agenda, qui ne diffèrent que par le `Blob` construit en amont.
 *
 * Le `revoke` est DIFFÉRÉ (`setTimeout`) plutôt qu'immédiatement après `click()` : sur Firefox/Safari,
 * une révocation synchrone court-circuite le téléchargement avant que le navigateur n'ait amorcé la
 * requête sur l'URL `blob:` — course connue, le délai laisse le temps au téléchargement de démarrer.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
