import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import express from "express";
import http from "node:http";
// @ts-expect-error — module JS sans types, c'est le patron du dossier `server/`
import { realtimeFluxHandler, realtimeActif, realtimePushHandler } from "../api/realtime.js";

/**
 * LE RELAIS, contre de VRAIS serveurs.
 *
 * On monte trois processus HTTP : un faux émetteur de ticket (le rôle du legacy PHP ou du backend
 * Node), un faux hub SSE, et le relais lui-même. Aucun mock : ce qui casse un relais SSE — les
 * en-têtes, la propagation d'un refus, la coupure de l'amont quand le client raccroche — ne se
 * teste pas sur un faux.
 */

function ecouter(app: express.Express | http.RequestListener): Promise<{ url: string; fermer: () => Promise<void>; serveur: http.Server }> {
  return new Promise((ok) => {
    const s = http.createServer(app as http.RequestListener);
    s.listen(0, "127.0.0.1", () => {
      const a = s.address();
      const port = typeof a === "object" && a ? a.port : 0;
      ok({
        url: `http://127.0.0.1:${port}`,
        serveur: s,
        fermer: () => new Promise((f) => { s.closeAllConnections?.(); s.close(() => f()); }),
      });
    });
  });
}

/** Ce que le faux hub a vu — c'est là qu'on observe si l'amont est bien coupé. */
const hubEtat = {
  ouvertures: 0,
  fermetures: 0,
  ticketsRecus: [] as string[],
  autorisationsVues: [] as (string | undefined)[],
  cassesVues: [] as string[],
  refuser: false,
};
const emetteurEtat = {
  appels: 0,
  autorisationsVues: [] as (string | undefined)[],
  /** La CASSE exacte reçue sur le fil — c'est elle qui décide côté legacy (BUG-L-252). */
  cassesVues: [] as string[],
  reponse: 200 as number,
  corps: JSON.stringify({ result: true, ticket: "T-VALIDE", expireLe: "2030-01-01T00:00:00.000Z" }),
};

let emetteur: Awaited<ReturnType<typeof ecouter>>;
let hub: Awaited<ReturnType<typeof ecouter>>;
let relais: Awaited<ReturnType<typeof ecouter>>;

beforeAll(async () => {
  const appEmetteur = express();
  appEmetteur.post("/realtime/ticket", (req, res) => {
    emetteurEtat.appels++;
    emetteurEtat.autorisationsVues.push(req.headers.authorization);
    emetteurEtat.cassesVues.push(...req.rawHeaders.filter((_, i) => i % 2 === 0).filter((h) => /^authorization$/i.test(h)));
    res.status(emetteurEtat.reponse).type("application/json").send(emetteurEtat.corps);
  });
  emetteur = await ecouter(appEmetteur);

  const appHub = express();
  appHub.get("/realtime/flux", (req, res) => {
    hubEtat.ticketsRecus.push(String(req.headers["x-realtime-ticket"] ?? ""));
    hubEtat.autorisationsVues.push(req.headers.authorization);
    hubEtat.cassesVues.push(...req.rawHeaders.filter((_, i) => i % 2 === 0).filter((h) => /^authorization$/i.test(h)));
    if (hubEtat.refuser) { res.status(401).json({ result: false }); return; }
    hubEtat.ouvertures++;
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
    res.write("retry: 3000\n\n");
    const bat = setInterval(() => res.write(": ping\n\n"), 80);
    req.on("close", () => { clearInterval(bat); hubEtat.fermetures++; });
  });
  appHub.use(express.json());
  appHub.get("/realtime/push/cle", (_req, res) => res.json({ result: true, publicKey: "CLE-PUBLIQUE-DE-TEST" }));
  appHub.post("/realtime/push/refuse", (_req, res) => res.status(418).json({ result: false }));
  appHub.post("/realtime/push/abonnement", (req, res) => res.json({
    result: true,
    recu: req.body,
    autorisation: req.headers.authorization ?? null,
    origine: req.headers.origin ?? null,
  }));
  hub = await ecouter(appHub);

  const appRelais = express();
  // ⚠️ L'ORDRE est reproduit à l'identique des deux serveurs, et c'est le point du test : le flux
  // AVANT `express.json()` (il n'a pas de corps et ne doit pas être bufferisé), le push APRÈS
  // (il en a un). Monter le push avant ferait repartir un abonnement valide en 400.
  appRelais.get("/api/realtime/flux", realtimeFluxHandler);
  appRelais.use(express.json());
  appRelais.all("/api/realtime/push/*splat", realtimePushHandler);
  relais = await ecouter(appRelais);
});

afterAll(async () => { await relais.fermer(); await hub.fermer(); await emetteur.fermer(); });

beforeEach(() => {
  hubEtat.ouvertures = 0; hubEtat.fermetures = 0; hubEtat.ticketsRecus = []; hubEtat.refuser = false;
  hubEtat.autorisationsVues = []; hubEtat.cassesVues = [];
  emetteurEtat.appels = 0; emetteurEtat.autorisationsVues = []; emetteurEtat.cassesVues = []; emetteurEtat.reponse = 200;
  emetteurEtat.corps = JSON.stringify({ result: true, ticket: "T-VALIDE" });
  process.env.REALTIME_HUB_URL = hub.url;
  process.env.REALTIME_TICKET_URL = `${emetteur.url}/realtime/ticket`;
});

afterEach(() => { delete process.env.REALTIME_HUB_URL; delete process.env.REALTIME_TICKET_URL; });

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ouvre le flux à travers le relais et rend de quoi lire et raccrocher. */
async function ouvrir(entetes: Record<string, string> = { authorization: "Bearer jeton-de-test" }) {
  const abandon = new AbortController();
  const r = await fetch(`${relais.url}/api/realtime/flux`, { headers: entetes, signal: abandon.signal });
  const recu: string[] = [];
  const lecture = (async () => {
    if (!r.body) return;
    const l = r.body.getReader(); const d = new TextDecoder();
    try { for (;;) { const { done, value } = await l.read(); if (done) break; recu.push(d.decode(value, { stream: true })); } } catch { /* abandon */ }
  })();
  return { reponse: r, texte: () => recu.join(""), raccrocher: () => { abandon.abort(); return lecture; } };
}

describe("absence de configuration", () => {
  it("sans `REALTIME_HUB_URL`, la fonctionnalité est ABSENTE — pas en panne", async () => {
    delete process.env.REALTIME_HUB_URL;
    delete process.env.REALTIME_TICKET_URL;
    expect(realtimeActif()).toBe(false);
    const r = await fetch(`${relais.url}/api/realtime/flux`, { headers: { authorization: "Bearer x" } });
    expect(r.status).toBe(503);
    // `realtime:false` est ce que le client lit pour rester en polling sans afficher d'erreur.
    expect(await r.json()).toMatchObject({ realtime: false });
  });

  it("avec la variable, le relais s’annonce actif", () => {
    expect(realtimeActif()).toBe(true);
  });
});

describe("l’authentification est DÉLÉGUÉE — le relais ne vérifie aucun jeton", () => {
  it("refuse net une requête sans `Authorization`, sans déranger l’émetteur", async () => {
    const r = await fetch(`${relais.url}/api/realtime/flux`);
    expect(r.status).toBe(401);
    expect(emetteurEtat.appels).toBe(0);
  });

  it("transmet le jeton du client À L’ÉMETTEUR — c’est lui qui détient la clé", async () => {
    const f = await ouvrir({ authorization: "Bearer jeton-precis-123" });
    try {
      expect(emetteurEtat.autorisationsVues).toEqual(["Bearer jeton-precis-123"]);
    } finally { await f.raccrocher(); }
  });

  it("envoie `Authorization` avec une MAJUSCULE — le legacy cherche la clé exacte (BUG-L-252)", async () => {
    // Express normalise les en-têtes ENTRANTS en minuscules ; retransmettre la clé telle quelle
    // envoyait `authorization` sur le fil, que le legacy ne trouve pas. undici, lui, PRÉSERVE la
    // casse qu'on lui donne (vérifié sur le fil) — la correction est donc ici, sans dépendre du
    // correctif legacy.
    const f = await ouvrir({ authorization: "Bearer x" });
    try {
      expect(emetteurEtat.cassesVues).toContain("Authorization");
      expect(emetteurEtat.cassesVues).not.toContain("authorization");
    } finally { await f.raccrocher(); }
  });

  it("un refus de l’émetteur devient un 401 pour le client, et RIEN n’est ouvert sur le hub", async () => {
    emetteurEtat.reponse = 401;
    emetteurEtat.corps = JSON.stringify({ result: false });
    const r = await fetch(`${relais.url}/api/realtime/flux`, { headers: { authorization: "Bearer faux" } });
    expect(r.status).toBe(401);
    expect(hubEtat.ouvertures).toBe(0);
  });

  it("un émetteur injoignable donne 502 — une panne d’infra n’est pas un refus d’identité", async () => {
    process.env.REALTIME_TICKET_URL = "http://127.0.0.1:1/realtime/ticket";
    const r = await fetch(`${relais.url}/api/realtime/flux`, { headers: { authorization: "Bearer x" } });
    expect(r.status).toBe(502);
  });

  it("un émetteur qui répond 200 SANS ticket est une panne, pas un flux vide", async () => {
    emetteurEtat.corps = JSON.stringify({ result: true });
    const r = await fetch(`${relais.url}/api/realtime/flux`, { headers: { authorization: "Bearer x" } });
    expect(r.status).toBe(502);
  });
});

describe("le ticket ne descend JAMAIS au navigateur", () => {
  it("le hub reçoit le ticket ; la réponse au client n’en porte aucune trace", async () => {
    const f = await ouvrir();
    try {
      await attendre(150);
      expect(hubEtat.ticketsRecus).toEqual(["T-VALIDE"]);      // l'amont l'a
      expect(f.texte()).not.toContain("T-VALIDE");             // l'aval ne l'a pas
      expect(JSON.stringify([...f.reponse.headers])).not.toContain("T-VALIDE");
    } finally { await f.raccrocher(); }
  });
});

describe("le transport", () => {
  it("annonce `text/event-stream` et INTERDIT toute transformation", async () => {
    const f = await ouvrir();
    try {
      expect(f.reponse.headers.get("content-type")).toMatch(/text\/event-stream/);
      // `no-transform` : la seconde ligne de défense derrière le montage avant `compression()`.
      expect(f.reponse.headers.get("cache-control")).toMatch(/no-transform/);
    } finally { await f.raccrocher(); }
  });

  it("recopie le flux amont OCTET POUR OCTET — le relais ne lit pas les événements", async () => {
    const f = await ouvrir();
    try {
      await attendre(250);
      const t = f.texte();
      expect(t).toContain("retry: 3000");
      expect(t).toContain(": ping");
    } finally { await f.raccrocher(); }
  });

  it("les en-têtes partent AVANT le premier événement — sinon le client reste en `pending`", async () => {
    // `fetch` ne résout que quand les en-têtes sont arrivés : la résolution EST la preuve.
    const f = await ouvrir();
    try { expect(f.reponse.status).toBe(200); } finally { await f.raccrocher(); }
  });
});

describe("le nettoyage — une fuite de connexion par visite, sinon", () => {
  // On mesure des DELTAS : les fermetures des tests precedents remontent au hub de facon
  // asynchrone et peuvent atterrir apres le `beforeEach` qui remet les compteurs a zero.
  // Un absolu ferait echouer le test pour une raison qui ne regarde pas le relais.
  it("le client qui raccroche COUPE l’amont", async () => {
    const f = await ouvrir();
    await attendre(200);
    expect(hubEtat.ouvertures).toBe(1);
    const avant = hubEtat.fermetures;
    await f.raccrocher();
    await attendre(400);
    expect(hubEtat.fermetures - avant).toBe(1);
  });

  it("dix ouvertures et dix raccrochages ne laissent rien derrière", async () => {
    const flux = [];
    for (let i = 0; i < 10; i++) flux.push(await ouvrir());
    await attendre(250);
    expect(hubEtat.ouvertures).toBe(10);
    const avant = hubEtat.fermetures;
    for (const f of flux) await f.raccrocher();
    await attendre(600);
    expect(hubEtat.fermetures - avant).toBe(10);
  });
});

describe("le mode DIRECT — un hub qui établit l’identité lui-même", () => {
  // `REALTIME_TICKET_URL=none` : le hub est en introspection, il n'y a AUCUN ticket à prendre,
  // donc aucune écriture en base nulle part. C'est le mode d'un hub branché sur une PRODUCTION
  // avec un utilisateur Mongo en lecture seule.
  it("ne demande AUCUN ticket et transmet l’`Authorization` au hub", async () => {
    process.env.REALTIME_TICKET_URL = "none";
    const f = await ouvrir({ authorization: "Bearer direct-123" });
    try {
      await attendre(150);
      expect(emetteurEtat.appels).toBe(0);            // l'émetteur n'est jamais dérangé
      expect(hubEtat.autorisationsVues).toContain("Bearer direct-123");
      expect(hubEtat.ticketsRecus).toEqual([""]);     // aucun ticket sur le fil
    } finally { await f.raccrocher(); }
  });

  it("envoie `Authorization` avec une MAJUSCULE (BUG-L-252)", async () => {
    process.env.REALTIME_TICKET_URL = "none";
    const f = await ouvrir({ authorization: "Bearer x" });
    try {
      await attendre(150);
      expect(hubEtat.cassesVues).toContain("Authorization");
      expect(hubEtat.cassesVues).not.toContain("authorization");
    } finally { await f.raccrocher(); }
  });

  it("un 401 du hub est RENDU AU CLIENT, pas masqué en 502", async () => {
    // En mode ticket, un 401 signale une erreur de déploiement. En mode direct, il vient du jeton
    // du client : le masquer le ferait boucler sans jamais lui dire de se reconnecter.
    process.env.REALTIME_TICKET_URL = "none";
    hubEtat.refuser = true;
    const r = await fetch(`${relais.url}/api/realtime/flux`, { headers: { authorization: "Bearer périmé" } });
    expect(r.status).toBe(401);
  });

  it("sans `Authorization`, refuse avant même de joindre le hub", async () => {
    process.env.REALTIME_TICKET_URL = "none";
    const r = await fetch(`${relais.url}/api/realtime/flux`);
    expect(r.status).toBe(401);
    expect(hubEtat.ouvertures).toBe(0);
  });
});

describe("le relais push", () => {
  it("transmet la clé publique", async () => {
    const r = await fetch(`${relais.url}/api/realtime/push/cle`);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ publicKey: "CLE-PUBLIQUE-DE-TEST" });
  });

  it("TRANSMET LE CORPS JSON — la preuve que le montage est après `express.json()`", async () => {
    const r = await fetch(`${relais.url}/api/realtime/push/abonnement`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer j" },
      body: JSON.stringify({ endpoint: "https://push.exemple/xyz", keys: { p256dh: "p", auth: "a" } }),
    });
    expect(r.status).toBe(200);
    // Le faux hub renvoie ce qu'il a REÇU : un corps vide ici signifierait un montage trop tôt.
    expect(await r.json()).toMatchObject({ recu: { endpoint: "https://push.exemple/xyz" } });
  });

  it("transmet l’`Authorization` et l’`Origin` — l’origine rend le multi-site diagnosticable", async () => {
    const r = await fetch(`${relais.url}/api/realtime/push/abonnement`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer precis", origin: "https://sitea.fr" },
      body: JSON.stringify({ endpoint: "e" }),
    });
    expect(await r.json()).toMatchObject({ autorisation: "Bearer precis", origine: "https://sitea.fr" });
  });

  it("propage le code du hub plutôt que de le masquer", async () => {
    const r = await fetch(`${relais.url}/api/realtime/push/refuse`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(r.status).toBe(418);
  });

  it("sans configuration, répond `push:false` — pas une erreur", async () => {
    delete process.env.REALTIME_HUB_URL;
    const r = await fetch(`${relais.url}/api/realtime/push/cle`);
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ push: false });
  });
});

describe("un hub qui refuse", () => {
  it("un ticket refusé PAR LE HUB est un 502 — c’est une erreur de déploiement, pas du client", async () => {
    // Le cas réel : l'émetteur et le hub ne pointent pas la même base. Rendre 401 ferait croire
    // au client qu'il doit se reconnecter, en boucle et sans fin.
    hubEtat.refuser = true;
    const r = await fetch(`${relais.url}/api/realtime/flux`, { headers: { authorization: "Bearer x" } });
    expect(r.status).toBe(502);
  });

  it("un hub injoignable donne 502 sans laisser la requête pendre", async () => {
    process.env.REALTIME_HUB_URL = "http://127.0.0.1:1";
    process.env.REALTIME_TICKET_URL = `${emetteur.url}/realtime/ticket`;
    const r = await fetch(`${relais.url}/api/realtime/flux`, { headers: { authorization: "Bearer x" } });
    expect(r.status).toBe(502);
  });
});
