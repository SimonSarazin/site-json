/**
 * RELAIS TEMPS RÉEL — le pont entre le navigateur et le hub SSE.
 *
 * Pourquoi un relais plutôt qu'une connexion directe navigateur → hub :
 *  1. le hub n'est pas forcément exposé publiquement (réseau interne Coolify) ;
 *  2. il n'y aurait sinon aucun moyen d'éviter le CORS large sur une route qui tient
 *     des connexions ouvertes ;
 *  3. surtout — **le ticket ne descend jamais jusqu'au navigateur**. Le relais l'obtient,
 *     s'en sert, et le jette. Un ticket est à usage unique et vit 30 s : moins il voyage,
 *     moins il y a de fenêtre.
 *
 * ── LA CIBLE PEUT ÊTRE LE LEGACY ─────────────────────────────────────────────
 * C'est la contrainte fondatrice (docs/29 §8). Le hub ne détient AUCUNE clé de signature :
 * il ne sait pas vérifier un JWT. C'est l'émetteur du ticket — legacy PHP ou backend Node,
 * celui-là même que la lib interroge — qui authentifie, avec SA clé. D'où deux URL distinctes :
 *
 *   REALTIME_TICKET_URL  l'émetteur, qui partage la clé de la lib   (legacy OU node)
 *   REALTIME_HUB_URL     le hub SSE, qui ne partage rien            (toujours node)
 *
 * Sans `REALTIME_HUB_URL`, la fonctionnalité est simplement absente : le relais répond 503
 * avec `{realtime:false}`, que le client lit comme « repasse au polling » — pas comme une panne.
 *
 * ── CONDITIONS DE RECETTE ────────────────────────────────────────────────────
 *  · monté AVANT `compression()` dans `prod-server.js`. Sur un flux SSE, le test de seuil du
 *    middleware est faux des deux côtés (la longueur n'est affectée qu'au `res.end`, qui
 *    n'arrive jamais) : il compresserait tout dans un tampon jamais vidé. Symptôme : un flux
 *    « qui ne marche pas », sans une seule erreur.
 *  · `Cache-Control: no-transform` — seconde ligne de défense, pour les intermédiaires.
 *  · `res.flushHeaders()` — sans quoi Express attend le premier write pour envoyer les en-têtes,
 *    et le client reste en `pending` jusqu'au premier événement.
 *  · l'abandon du client DOIT couper l'amont, sinon on fuit une connexion par visite.
 */

/** Le hub ne répond jamais instantanément : on lui laisse le temps d'ouvrir, pas de finir. */
const DELAI_OUVERTURE_MS = 10_000;

function cibles() {
  const hub = process.env.REALTIME_HUB_URL?.replace(/\/+$/, "");
  if (!hub) return null;
  const ticket = process.env.REALTIME_TICKET_URL || `${hub}/realtime/ticket`;
  return {
    hub: `${hub}/realtime/flux`,
    // `none` = le hub établit l'identité LUI-MÊME (mode introspection) : il n'y a pas de ticket à
    // prendre, donc aucune écriture en base nulle part. C'est le mode d'un hub branché sur une
    // PRODUCTION avec un utilisateur Mongo en lecture seule. Le relais se contente alors de
    // transmettre l'`Authorization` du client.
    ticket: ticket === "none" ? null : ticket,
  };
}

/** Vrai si le temps réel est configuré sur ce déploiement. Exporté pour les tests, et
 *  disponible pour une sonde de santé — il n'y en a pas encore. */
export function realtimeActif() {
  return cibles() !== null;
}

/**
 * `GET /api/realtime/flux` — ouvre le flux.
 *
 * Le client envoie son `Authorization` habituel, celui de la lib. Le relais s'en sert UNE fois
 * pour prendre un ticket, puis ouvre le flux amont avec ce ticket. Le navigateur ne le voit pas.
 */
export async function realtimeFluxHandler(req, res) {
  const c = cibles();
  if (!c) {
    return res.status(503).json({ realtime: false, msg: "temps reel non configure sur ce deploiement" });
  }

  const autorisation = req.headers.authorization;
  if (!autorisation) {
    return res.status(401).json({ realtime: false, msg: "authentification requise" });
  }

  // 1. Prendre un ticket auprès de l'émetteur — c'est LUI qui vérifie l'identité.
  //    Sauf en mode direct (`REALTIME_TICKET_URL=none`), où le hub s'en charge par introspection.
  let ticket = null;
  if (c.ticket) try {
    const r = await fetch(c.ticket, {
      method: "POST",
      // `Authorization` avec une MAJUSCULE, délibérément. Express normalise les en-têtes ENTRANTS
      // en minuscules (`req.headers.authorization`) ; retransmettre cette clé telle quelle envoyait
      // `authorization` sur le fil, et le legacy — qui cherche la clé exacte `Authorization` — ne
      // voyait aucun jeton (BUG-L-252). undici, lui, préserve la casse qu'on lui donne : c'est donc
      // ici que ça se règle, sans dépendre du correctif legacy.
      headers: { Authorization: autorisation, "content-type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(DELAI_OUVERTURE_MS),
    });
    if (r.status === 401 || r.status === 403) {
      return res.status(401).json({ realtime: false, msg: "authentification refusee" });
    }
    if (!r.ok) {
      return res.status(502).json({ realtime: false, msg: "emetteur de ticket indisponible" });
    }
    const corps = await r.json();
    ticket = corps?.ticket;
    if (!ticket) return res.status(502).json({ realtime: false, msg: "emetteur sans ticket" });
  } catch {
    return res.status(502).json({ realtime: false, msg: "emetteur de ticket injoignable" });
  }

  // 2. Ouvrir le flux amont. L'abandon du client coupe l'amont — la seule protection contre
  //    une fuite de connexion par visite.
  //    ⚠️ `Authorization` avec une MAJUSCULE : voir le commentaire du mode ticket (BUG-L-252).
  const entetesAmont = ticket
    ? { "x-realtime-ticket": ticket, accept: "text/event-stream" }
    : { Authorization: autorisation, accept: "text/event-stream" };
  const abandon = new AbortController();
  const couper = () => abandon.abort();
  res.on("close", couper);

  let amont;
  try {
    amont = await fetch(c.hub, { headers: entetesAmont, signal: abandon.signal });
  } catch {
    res.off("close", couper);
    if (!res.headersSent) res.status(502).json({ realtime: false, msg: "hub injoignable" });
    return;
  }

  if (!amont.ok || !amont.body) {
    res.off("close", couper);
    abandon.abort();
    // En mode ticket, un 401 ici veut dire que l'émetteur et le hub ne partagent pas la même base :
    // erreur de DÉPLOIEMENT, pas du client, d'où le 502. En mode direct, le 401 vient du jeton du
    // client lui-même et doit lui être rendu tel quel — le masquer le ferait boucler.
    const code = amont.status === 401 ? (ticket ? 502 : 401) : amont.status;
    if (!res.headersSent) res.status(code).json({ realtime: false, msg: "hub a refuse l ouverture" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();

  // 3. Recopier octet pour octet. Le relais ne LIT pas les événements : il ne connaît ni les
  //    topics ni les salles, et n'a donc rien à décider. C'est ce qui le rend générique.
  const lecteur = amont.body.getReader();
  try {
    for (;;) {
      const { done, value } = await lecteur.read();
      if (done) break;
      res.write(value);
      res.flush?.();
    }
  } catch {
    /* amont coupé ou client parti : la fermeture ci-dessous s'en charge */
  } finally {
    res.off("close", couper);
    try { res.end(); } catch { /* déjà fermé */ }
  }
}

/**
 * `/api/realtime/push/*` — relais des routes d'abonnement push.
 *
 * Même raison que pour le flux : le hub n'est pas forcément exposé, et le client n'a pas à
 * connaître son adresse. Ici le relais est un simple proxy JSON — il ne décide de rien, et
 * transmet l'`Authorization` telle quelle, parce que c'est le hub qui l'exige et la vérifie.
 *
 * ⚠️ `Origin` est transmis exprès : le hub s'en sert pour tracer sur QUEL déploiement un
 * abonnement a été pris — la donnée qui rend le multi-site diagnosticable.
 */
export async function realtimePushHandler(req, res) {
  const c = cibles();
  if (!c) return res.status(503).json({ realtime: false, push: false });

  // `/api/realtime/push/cle` -> `/realtime/push/cle`
  const suffixe = req.path.replace(/^\/api\/realtime\/push/, "") || "/";
  const url = `${c.hub}`.replace(/\/realtime\/flux$/, "") + `/realtime/push${suffixe}`;

  const entetes = { "content-type": "application/json" };
  // Majuscule : voir le commentaire dans realtimeFluxHandler (BUG-L-252).
  if (req.headers.authorization) entetes.Authorization = req.headers.authorization;
  if (req.headers.origin) entetes.origin = req.headers.origin;

  try {
    const amont = await fetch(url, {
      method: req.method,
      headers: entetes,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : JSON.stringify(req.body ?? {}),
      signal: AbortSignal.timeout(DELAI_OUVERTURE_MS),
    });
    const texte = await amont.text();
    res.status(amont.status).type("application/json").send(texte || "{}");
  } catch {
    res.status(502).json({ result: false, msg: "hub injoignable" });
  }
}
