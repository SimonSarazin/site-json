/**
 * Client OVH minimal, limité à la zone DNS d'amorce.
 *
 * POURQUOI si peu — l'outil n'a besoin que d'une chose : créer le CNAME
 * `<site>.00.re → 00.re.` d'un nouveau site. Les domaines propres des clients
 * vivent chez d'autres registrars et se pointent à la main ; ce module ne doit
 * jamais chercher à les toucher.
 *
 * Aucune dépendance : la signature v1 d'OVH tient en une ligne de SHA-1.
 *
 *   X-Ovh-Signature = "$1$" + sha1(AS + "+" + CK + "+" + MÉTHODE + "+" + URL
 *                                     + "+" + CORPS + "+" + HORODATAGE)
 *
 * L'horloge est le mode de panne classique : la signature inclut un horodatage
 * qu'OVH refuse au-delà de quelques minutes de dérive. On lit donc `/auth/time`
 * une fois et on applique le décalage, comme le font les SDK officiels.
 *
 * Identifiants attendus dans `.env` (gitignoré) :
 *   OVH_ENDPOINT=ovh-eu
 *   OVH_APPLICATION_KEY, OVH_APPLICATION_SECRET, OVH_CONSUMER_KEY
 *
 * Ils se créent sur https://eu.api.ovh.com/createToken/ avec des droits scopés.
 * N'accorder QUE ce qui est nécessaire — `GET` et `POST` sur
 * `/domain/zone/00.re/*`. Surtout pas `DELETE` : ce module n'a aucune commande
 * de suppression, et une clé qui ne peut pas détruire une zone est une clé
 * qu'on peut laisser vivre sans angoisse.
 */
import crypto from "node:crypto";
import { lireDotEnv } from "./deploy-config";
import { ROOT } from "./sites";

const ENDPOINTS: Record<string, string> = {
  "ovh-eu": "https://eu.api.ovh.com/1.0",
  "ovh-ca": "https://ca.api.ovh.com/1.0",
  "ovh-us": "https://api.us.ovhcloud.com/1.0",
  "kimsufi-eu": "https://eu.api.kimsufi.com/1.0",
  "soyoustart-eu": "https://eu.api.soyoustart.com/1.0",
};

export class OvhError extends Error {}

export interface OvhCredentials {
  base: string;
  applicationKey: string;
  applicationSecret: string;
  consumerKey: string;
}

export function chargerIdentifiants(root: string = ROOT): OvhCredentials {
  const env = { ...lireDotEnv(root), ...process.env };
  const manquantes = ["OVH_APPLICATION_KEY", "OVH_APPLICATION_SECRET", "OVH_CONSUMER_KEY"].filter(
    (k) => !env[k],
  );
  if (manquantes.length) {
    throw new OvhError(
      `Identifiants OVH absents : ${manquantes.join(", ")}.\n` +
        `  Les créer sur https://eu.api.ovh.com/createToken/ avec, au minimum :\n` +
        `    GET  /domain/zone/*\n    POST /domain/zone/*\n` +
        `  puis les poser dans .env (gitignoré).`,
    );
  }
  const nom = env.OVH_ENDPOINT ?? "ovh-eu";
  const base = ENDPOINTS[nom];
  if (!base) throw new OvhError(`OVH_ENDPOINT inconnu : "${nom}" (${Object.keys(ENDPOINTS).join(", ")})`);
  return {
    base,
    applicationKey: env.OVH_APPLICATION_KEY as string,
    applicationSecret: env.OVH_APPLICATION_SECRET as string,
    consumerKey: env.OVH_CONSUMER_KEY as string,
  };
}

let decalage: number | null = null;

/** Décalage entre l'horloge locale et celle d'OVH, en secondes. Lu une seule fois. */
async function synchroniser(c: OvhCredentials): Promise<number> {
  if (decalage !== null) return decalage;
  const r = await fetch(`${c.base}/auth/time`);
  if (!r.ok) throw new OvhError(`GET /auth/time → HTTP ${r.status}`);
  decalage = Number(await r.text()) - Math.floor(Date.now() / 1000);
  return decalage;
}

async function ovh<T>(
  c: OvhCredentials,
  methode: "GET" | "POST" | "PUT",
  chemin: string,
  corps?: unknown,
): Promise<T> {
  const url = `${c.base}${chemin}`;
  const body = corps === undefined ? "" : JSON.stringify(corps);
  const ts = String(Math.floor(Date.now() / 1000) + (await synchroniser(c)));
  const signature =
    "$1$" +
    crypto
      .createHash("sha1")
      .update([c.applicationSecret, c.consumerKey, methode, url, body, ts].join("+"))
      .digest("hex");

  const r = await fetch(url, {
    method: methode,
    headers: {
      "X-Ovh-Application": c.applicationKey,
      "X-Ovh-Consumer": c.consumerKey,
      "X-Ovh-Timestamp": ts,
      "X-Ovh-Signature": signature,
      "Content-Type": "application/json",
    },
    ...(body ? { body } : {}),
  });

  const texte = await r.text();
  if (!r.ok) throw new OvhError(`${methode} ${chemin} → HTTP ${r.status} : ${texte.slice(0, 250)}`);
  if (!texte.trim()) return undefined as T;
  return JSON.parse(texte) as T;
}

export interface OvhRecord {
  id: number;
  zone: string;
  subDomain: string;
  fieldType: string;
  target: string;
  ttl: number;
}

/** Les zones que le compte détient — sert à vérifier avant d'écrire. */
export const listerZones = (c: OvhCredentials): Promise<string[]> => ovh(c, "GET", "/domain/zone");

/** L'enregistrement CNAME d'un sous-domaine, ou `null`. */
export async function trouverCname(
  c: OvhCredentials,
  zone: string,
  sousDomaine: string,
): Promise<OvhRecord | null> {
  const ids = await ovh<number[]>(
    c,
    "GET",
    `/domain/zone/${zone}/record?fieldType=CNAME&subDomain=${encodeURIComponent(sousDomaine)}`,
  );
  if (ids.length === 0) return null;
  return ovh<OvhRecord>(c, "GET", `/domain/zone/${zone}/record/${ids[0]}`);
}

export const creerCname = (
  c: OvhCredentials,
  zone: string,
  sousDomaine: string,
  cible: string,
  ttl = 3600,
): Promise<OvhRecord> =>
  ovh(c, "POST", `/domain/zone/${zone}/record`, {
    fieldType: "CNAME",
    subDomain: sousDomaine,
    target: cible.endsWith(".") ? cible : `${cible}.`,
    ttl,
  });

/**
 * Publie la zone.
 *
 * OBLIGATOIRE après toute écriture, et c'est le mode de panne silencieux le plus
 * courant de cette API : sans lui l'enregistrement existe en base, un GET le
 * montre, mais le DNS public ne le sert jamais.
 */
export const rafraichirZone = (c: OvhCredentials, zone: string): Promise<void> =>
  ovh(c, "POST", `/domain/zone/${zone}/refresh`);
