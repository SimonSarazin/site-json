import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import express from "express";
import http from "node:http";
// @ts-expect-error — module JS sans types, c'est le patron du dossier `server/`
import { helloassoCallbackRedirect } from "../api/helloasso-callback.js";

/** Retour HelloAsso de l'ancienne route : redirigé vers la page de retour du backend, query comprise. */

let serveur: http.Server;
let url = "";
const backendInitial = process.env.VITE_BASE_URL_BACKEND;

beforeAll(async () => {
  const app = express();
  app.get("/api/helloasso/callback", helloassoCallbackRedirect);
  serveur = http.createServer(app);
  await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", () => ok()));
  const adresse = serveur.address();
  url = `http://127.0.0.1:${typeof adresse === "object" && adresse ? adresse.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((ok) => serveur.close(() => ok()));
});

afterEach(() => {
  if (backendInitial === undefined) delete process.env.VITE_BASE_URL_BACKEND;
  else process.env.VITE_BASE_URL_BACKEND = backendInitial;
});

describe("GET /api/helloasso/callback", () => {
  it("redirige vers le callback du backend en gardant la query", async () => {
    process.env.VITE_BASE_URL_BACKEND = "https://www.communecter.org/";

    const reponse = await fetch(`${url}/api/helloasso/callback?status=return&checkoutIntentId=7&code=succeeded`, { redirect: "manual" });

    expect(reponse.status).toBe(302);
    expect(reponse.headers.get("location")).toBe(
      "https://www.communecter.org/co2/helloAsso/callback?status=return&checkoutIntentId=7&code=succeeded",
    );
  });

  it("sans backend configuré : 404 JSON, comme toute route /api inconnue", async () => {
    delete process.env.VITE_BASE_URL_BACKEND;

    const reponse = await fetch(`${url}/api/helloasso/callback?status=return`, { redirect: "manual" });

    expect(reponse.status).toBe(404);
    expect(await reponse.json()).toEqual({ error: "Unknown API route" });
  });
});
