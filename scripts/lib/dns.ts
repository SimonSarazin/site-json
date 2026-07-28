/**
 * Résolution DNS — la vérification qui conditionne tout le reste.
 *
 * POURQUOI — Coolify demande ses certificats à Let's Encrypt en HTTP-01 : le
 * challenge n'aboutit que si le nom résout DÉJÀ vers le serveur au moment du
 * déploiement. Poser un domaine avant son DNS donne un site en certificat
 * auto-signé, et le diagnostic est pénible parce que rien n'échoue bruyamment.
 *
 * Le suivi de chaîne CNAME est gratuit : `resolve4` la traverse. Peu importe donc
 * qu'un domaine propre passe par deux sauts
 * (`www.tiers-lieux.org → tierslieux.00.re → 00.re`) — seule l'IP finale compte,
 * pour nous comme pour Let's Encrypt.
 */
import { Resolver } from "node:dns/promises";

/** IP du serveur Coolify — la cible que tout domaine du parc doit atteindre. */
export const IP_SERVEUR = "152.228.161.70";

/**
 * Les IPv4 auxquelles un nom aboutit, chaîne CNAME suivie.
 *
 * `serveurs` permet d'interroger les NS autoritaires plutôt qu'un résolveur
 * public : juste après une écriture, les caches publics servent encore l'ancienne
 * réponse, et attendre leur expiration ferait perdre des minutes pour rien.
 */
export async function resoudre(nom: string, serveurs?: string[]): Promise<string[]> {
  const r = new Resolver({ timeout: 5000, tries: 2 });
  if (serveurs?.length) r.setServers(serveurs);
  try {
    return await r.resolve4(nom);
  } catch {
    return [];
  }
}

/** Le nom pointe-t-il déjà le serveur ? */
export const pointeVersLeServeur = async (nom: string, serveurs?: string[]): Promise<boolean> =>
  (await resoudre(nom, serveurs)).includes(IP_SERVEUR);

/**
 * Attend qu'un nom pointe le serveur. Rend `true` dès que c'est le cas, `false`
 * à l'expiration — jamais d'exception : l'appelant décide si c'est bloquant.
 */
export async function attendreResolution(
  nom: string,
  timeoutS: number,
  onTick?: (secondes: number) => void,
): Promise<boolean> {
  const debut = Date.now();
  for (;;) {
    if (await pointeVersLeServeur(nom)) return true;
    const ecoule = Math.round((Date.now() - debut) / 1000);
    if (ecoule >= timeoutS) return false;
    onTick?.(ecoule);
    await new Promise((r) => setTimeout(r, 10_000));
  }
}
