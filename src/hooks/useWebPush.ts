import { useCallback, useEffect, useState } from "react";

/**
 * ABONNEMENT AUX NOTIFICATIONS PUSH (cocolight docs/29 §12).
 *
 * Le SSE ne sert que les onglets ouverts ; le push arrive site fermé. Ce sont deux capacités
 * distinctes, et celle-ci coûte une PERMISSION — ce qui change tout dans la façon de la demander.
 *
 * ── LA RÈGLE D'OR DE LA PERMISSION ──────────────────────────────────────────────────────────
 * On ne demande JAMAIS la permission au chargement. Un refus est quasi définitif : le navigateur
 * n'affiche plus la demande, et la personne doit aller la rétablir dans les réglages du site.
 * `demander()` doit donc être appelé depuis un geste explicite — un interrupteur que la personne
 * actionne. Ce hook expose l'état, il ne déclenche rien de lui-même.
 *
 * ── LE MULTI-SITE ───────────────────────────────────────────────────────────────────────────
 * Un abonnement est lié à l'ORIGINE. S'abonner ici n'abonne pas les autres déploiements, et il n'y
 * a pas de contournement : le cloisonnement de stockage des navigateurs a tué le patron de
 * l'iframe à origine commune. Le serveur pousse à toutes les origines connues d'un compte, avec
 * la conséquence assumée d'un avertissement par site abonné.
 */

export type EtatPush =
  | "indisponible"    // pas de service worker, ou pas de PushManager
  | "desactive"       // le serveur ne fait pas de push
  | "refuse"          // la personne a refusé — on ne redemande pas
  | "inactif"         // possible, pas encore abonné
  | "abonne";

const CHEMIN_SW = "/sw.js";

/** base64url → Uint8Array, la forme qu'attend `applicationServerKey`. */
function versOctets(base64url: string): Uint8Array {
  const rembourrage = "=".repeat((4 - (base64url.length % 4)) % 4);
  const b64 = (base64url + rembourrage).replace(/-/g, "+").replace(/_/g, "/");
  const brut = atob(b64);
  const out = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i++) out[i] = brut.charCodeAt(i);
  return out;
}

/** Ce que `PushSubscription.toJSON()` rend d'utile. */
function versCorps(s: PushSubscription, siteSlug?: string) {
  const j = s.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  return { endpoint: j.endpoint, keys: j.keys, ...(siteSlug ? { siteSlug } : {}) };
}

export interface OptionsPush {
  /** Le jeton de la lib — l'abonnement est rattaché à un compte, donc authentifié. */
  jeton: string | null;
  siteSlug?: string;
  /** Préfixe des routes, relayées par le serveur SSR comme le flux. */
  base?: string;
}

export function useWebPush(o: OptionsPush) {
  const [etat, setEtat] = useState<EtatPush>("indisponible");
  const base = o.base ?? "/api/realtime/push";
  const { jeton, siteSlug } = o;

  // État initial : ce qui est possible, et ce qui est déjà en place. Aucune demande de permission.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let vivant = true;
    void (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) { setEtat("indisponible"); return; }
      if (Notification.permission === "denied") { setEtat("refuse"); return; }
      try {
        const r = await fetch(`${base}/cle`);
        if (!r.ok) { if (vivant) setEtat("desactive"); return; }
        const enregistrement = await navigator.serviceWorker.getRegistration(CHEMIN_SW);
        const existant = await enregistrement?.pushManager.getSubscription();
        if (vivant) setEtat(existant ? "abonne" : "inactif");
      } catch {
        if (vivant) setEtat("desactive");
      }
    })();
    return () => { vivant = false; };
  }, [base]);

  /** À n'appeler QUE depuis un geste de la personne. Voir la règle d'or ci-dessus. */
  const demander = useCallback(async (): Promise<EtatPush> => {
    if (!jeton) return "inactif";
    try {
      const rc = await fetch(`${base}/cle`);
      if (!rc.ok) { setEtat("desactive"); return "desactive"; }
      const { publicKey } = (await rc.json()) as { publicKey: string };

      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setEtat("refuse"); return "refuse"; }

      const enregistrement = await navigator.serviceWorker.register(CHEMIN_SW);
      await navigator.serviceWorker.ready;
      const abonnement = await enregistrement.pushManager.subscribe({
        // Obligatoire depuis Chrome 52 : un abonnement non chiffré est refusé.
        userVisibleOnly: true,
        applicationServerKey: versOctets(publicKey) as BufferSource,
      });

      const r = await fetch(`${base}/abonnement`, {
        method: "POST",
        headers: { authorization: `Bearer ${jeton}`, "content-type": "application/json" },
        body: JSON.stringify(versCorps(abonnement, siteSlug)),
      });
      if (!r.ok) {
        // Ne pas laisser un abonnement navigateur que le serveur ignore : il recevrait des pushs
        // que personne n'envoie, et surtout il masquerait l'échec au prochain chargement.
        await abonnement.unsubscribe().catch(() => {});
        setEtat("inactif");
        return "inactif";
      }
      setEtat("abonne");
      return "abonne";
    } catch {
      setEtat("inactif");
      return "inactif";
    }
  }, [base, jeton, siteSlug]);

  const retirer = useCallback(async (): Promise<void> => {
    try {
      const enregistrement = await navigator.serviceWorker.getRegistration(CHEMIN_SW);
      const abonnement = await enregistrement?.pushManager.getSubscription();
      if (abonnement) {
        // Prévenir le serveur AVANT de couper côté navigateur : après `unsubscribe()`, l'endpoint
        // n'est plus lisible, et la ligne resterait en base jusqu'au premier 410.
        await fetch(`${base}/abonnement`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: abonnement.endpoint }),
        }).catch(() => {});
        await abonnement.unsubscribe();
      }
    } finally {
      setEtat("inactif");
    }
  }, [base]);

  return { etat, demander, retirer };
}
