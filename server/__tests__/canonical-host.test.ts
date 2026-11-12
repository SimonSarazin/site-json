import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import express from "express";
import http from "node:http";
// @ts-expect-error — module JS sans types, c'est le patron du dossier `server/`
import { canonicalHostRedirect, regleHoteCanonique } from "../lib/canonicalHost.js";

/**
 * Redirection de l'hôte jumeau (apex nu ↔ `www.`) vers l'hôte canonique
 * (`server/lib/canonicalHost.js`), déduite de l'URL publique une fois au montage.
 * Le sous-domaine d'amorce et l'hôte canonique passent.
 */

type Middleware = (req: express.Request, res: express.Response, next: express.NextFunction) => void;

let serveur: http.Server;
let url = "";
/** Middleware courant : chaque test monte la règle qu'il veut sans relancer le serveur. */
let courant: Middleware = (_req, _res, next) => next();
const monter = (publicUrl: string | undefined) => {
  courant = canonicalHostRedirect(publicUrl);
};

/**
 * Requête avec un en-tête `Host` arbitraire, sans suivre les redirections. Passe par `http.request` :
 * `fetch` (undici) tient `Host` pour un en-tête interdit et le remplace en silence par l'adresse réelle.
 */
function requete(host: string, chemin = "/", method = "GET") {
  return new Promise<{ status: number; location: string | null; text: string }>((ok, ko) => {
    const { hostname, port } = new URL(url);
    const req = http.request({ hostname, port, path: chemin, method, headers: { host } }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { text += chunk; });
      res.on("end", () => ok({ status: res.statusCode ?? 0, location: res.headers.location ?? null, text }));
    });
    req.on("error", ko);
    req.end();
  });
}

beforeAll(async () => {
  const app = express();
  app.use((req, res, next) => courant(req, res, next));
  app.all("/{*all}", (req, res) => {
    res.status(200).type("text/plain").send(`servi ${req.method} ${req.headers.host}`);
  });
  serveur = http.createServer(app);
  await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", () => ok()));
  const adresse = serveur.address();
  url = `http://127.0.0.1:${typeof adresse === "object" && adresse ? adresse.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((ok) => serveur.close(() => ok()));
});

afterEach(() => {
  courant = (_req, _res, next) => next();
});

describe("regleHoteCanonique", () => {
  it("canonique en www : l'apex nu est l'hôte à rediriger", () => {
    expect(regleHoteCanonique("https://www.parent62.org")).toEqual({ de: "parent62.org", vers: "https://www.parent62.org" });
    expect(regleHoteCanonique("https://WWW.Parent62.org/")).toEqual({ de: "parent62.org", vers: "https://www.parent62.org" });
  });

  it("canonique nue : le www est l'hôte à rediriger — y compris pour une amorce 00.re", () => {
    expect(regleHoteCanonique("https://monsite.fr")).toEqual({ de: "www.monsite.fr", vers: "https://monsite.fr" });
    expect(regleHoteCanonique("https://tierslieux.00.re")).toEqual({ de: "www.tierslieux.00.re", vers: "https://tierslieux.00.re" });
  });

  it("ne rend rien sans URL ou sur une URL invalide", () => {
    expect(regleHoteCanonique(undefined)).toBeNull();
    expect(regleHoteCanonique("")).toBeNull();
    expect(regleHoteCanonique("pas une url")).toBeNull();
    expect(regleHoteCanonique("www.parent62.org")).toBeNull(); // sans schéma : invalide, pas de règle
    expect(regleHoteCanonique("https://www.")).toBeNull();
  });
});

describe("canonicalHostRedirect — canonique en www (parent62)", () => {
  it("301 de l'apex nu vers l'hôte canonique, chemin et query conservés", async () => {
    monter("https://www.parent62.org");

    const reponse = await requete("parent62.org", "/annuaire?zone=62&page=2");

    expect(reponse.status).toBe(301);
    expect(reponse.location).toBe("https://www.parent62.org/annuaire?zone=62&page=2");
  });

  it("ignore le port, la casse et le point final de l'en-tête Host", async () => {
    monter("https://www.parent62.org");

    expect((await requete("Parent62.ORG:443", "/")).location).toBe("https://www.parent62.org/");
    expect((await requete("parent62.org.", "/")).location).toBe("https://www.parent62.org/");
  });

  it("laisse passer l'hôte canonique", async () => {
    monter("https://www.parent62.org");

    const reponse = await requete("www.parent62.org", "/annuaire");

    expect(reponse.status).toBe(200);
    expect(reponse.text).toBe("servi GET www.parent62.org");
  });

  it("laisse passer le sous-domaine d'amorce et tout autre hôte", async () => {
    monter("https://www.parent62.org");

    expect((await requete("parent62.00.re")).status).toBe(200);
    expect((await requete("localhost:3000")).status).toBe(200);
    expect((await requete("autre-parent62.org")).status).toBe(200);
  });

  it("ne redirige ni POST ni les routes /api/, quelle que soit leur casse", async () => {
    monter("https://www.parent62.org");

    expect((await requete("parent62.org", "/api/realtime/flux")).status).toBe(200);
    expect((await requete("parent62.org", "/API/helloasso/callback?code=ok")).status).toBe(200);
    expect((await requete("parent62.org", "/contact", "POST")).status).toBe(200);
  });

  it("HEAD est redirigé comme GET", async () => {
    monter("https://www.parent62.org");

    const reponse = await requete("parent62.org", "/", "HEAD");

    expect(reponse.status).toBe(301);
    expect(reponse.location).toBe("https://www.parent62.org/");
  });
});

describe("canonicalHostRedirect — canonique nue", () => {
  it("301 du www vers l'apex canonique, l'apex et l'amorce passent", async () => {
    monter("https://monsite.fr");

    expect((await requete("www.monsite.fr", "/agenda?mois=11")).location).toBe("https://monsite.fr/agenda?mois=11");
    expect((await requete("monsite.fr", "/agenda")).status).toBe(200);
    expect((await requete("monsite.00.re", "/agenda")).status).toBe(200);
  });

  it("site servi sur sa seule amorce : tout passe", async () => {
    monter("https://tierslieux.00.re");

    expect((await requete("tierslieux.00.re")).status).toBe(200);
    expect((await requete("www.tiers-lieux.org")).status).toBe(200);
    expect((await requete("tiers-lieux.org")).status).toBe(200);
  });
});

describe("canonicalHostRedirect — sans règle", () => {
  it("sans URL publique ou URL invalide : tout passe", async () => {
    monter(undefined);
    expect((await requete("parent62.org")).status).toBe(200);

    monter("www.parent62.org");
    expect((await requete("parent62.org")).status).toBe(200);
  });
});
