import { getSlug } from "./constant/common";

/**
 * IDENTITÉ COSTUM DU SITE — le costum sous lequel CE déploiement parle au backend.
 *
 * Pourquoi c'est nécessaire : quand le legacy sert lui-même un costum, il l'apprend de l'URL. Ici le
 * domaine pointe sur site-json, donc plus rien ne le lui dit : c'est la REQUÊTE qui doit le porter.
 * `CommunecterController::beforeAction` → `costumCacheParams()` réchauffe le cache costum à partir du
 * `costumSlug` reçu en `$_POST`, et c'est ce cache que lisent `Mail::getCustomMail` / `Mail::getAppName`.
 * Sans ce paramètre : sujet « … sur Communecter », liens en `http://127.0.0.1:5080`, logo et expéditeur
 * génériques. Avec : sujet/logo/expéditeur du costum et liens sur `costum.host`. Mesuré sur
 * `/co2/person/register` (form-urlencoded ; en JSON `$_POST` est vide, tous les endpoints mailants
 * sont donc en form-urlencoded).
 *
 * Trois étages, du plus général au plus précis — les trois posent la MÊME valeur, ils diffèrent par le
 * moment où ils s'appliquent :
 *  1. `applySiteCostum(client)` (apiClient.ts + CocolightProvider) : le client injecte le trio dans le
 *     payload de tout endpoint MARQUÉ `costumContext: "request"` au contrat — le marqueur, pas la
 *     simple présence de `costumSlug` dans le schéma (65 endpoints le déclarent au sens métier) ;
 *  2. `ensureCostumScope(entity)` (lib/ensureCostumScope.ts) : force le costum du SITE sur une ENTITÉ,
 *     dont la lib dériverait sinon le scope de sa provenance (`source.key`) — une org hôte peut porter
 *     le `source.key` d'un costum ÉTRANGER (mesuré : institutBleu porte `source.key:"meir"`) ;
 *  3. `withSiteCostumParams(...)` : pose le trio à la main sur un `callEndpoint` brut.
 *
 * `getSlug()` lit `VITE_SLUG`, une valeur de PROCESSUS (1 processus = 1 site dans ce déploiement) :
 * un singleton de client API est donc sûr, l'identité ne change jamais en cours de vie du processus.
 */
export interface SiteCostumContext {
  costumSlug: string;
  costumId?: string;
  costumType?: string;
}

/** Contexte d'entité porteuse tel qu'exposé par `useCocolight()` (résolution réseau : peut être vide). */
export interface CostumCarrierCtx {
  contextId?: string | null;
  contextType?: string | null;
}

/**
 * Trio costum du site, ou `null` si ce déploiement n'en a pas (sentinelle : `VITE_SLUG` absent ou
 * `"default"`, la valeur de repli de `readEnv` — un site sans costum ne doit RIEN estampiller).
 *
 * `costumId`/`costumType` sont optionnels À DESSEIN : le legacy résout son cache costum sur le seul
 * slug de l'entité porteuse. Les omettre quand la résolution réseau n'a pas encore répondu vaut
 * toujours mieux que de ne rien envoyer du tout.
 */
export function getSiteCostumContext(ctx: CostumCarrierCtx = {}): SiteCostumContext | null {
  const slug = getSlug();
  if (!slug || slug === "default") return null;
  return {
    costumSlug: slug,
    ...(ctx.contextId ? { costumId: ctx.contextId } : {}),
    ...(ctx.contextType ? { costumType: ctx.contextType } : {}),
  };
}

/**
 * Forme minimale attendue du client API. `setSiteCostum` N'EXISTE PAS encore dans la version PUBLIÉE
 * de la lib (livrée en source, publication npm à venir) : on la déclare localement et on l'appelle en
 * optionnel pour compiler ET tourner contre les deux versions. À remplacer par l'appel typé
 * `client.setSiteCostum(...)` une fois la lib publiée (même patron que `callEndpoint` en clair dans
 * `useInvitationActions` / `JoinByLinkPage`).
 */
type SiteCostumCapableClient = {
  setSiteCostum?: (slug: string, opts?: { costumId?: string; costumType?: string }) => void;
  getRequestSchema?: (constant: string) => unknown;
  /** ≥ 1.0.192 : le marqueur `costumContext` du contrat, la seule règle qui compte. */
  hasCostumContext?: (constant: string) => boolean;
};

/**
 * Pose (ou repose) l'identité costum du site sur le client API. Idempotent, synchrone, sans réseau :
 * appelable à la construction du client PUIS à chaque fois que `contextId`/`contextType` arrivent
 * (résolution du slug, re-résolution après login). No-op sur une lib qui n'expose pas la méthode.
 */
export function applySiteCostum(client: unknown, ctx: CostumCarrierCtx = {}): void {
  if (!client || typeof client !== "object") return;
  const costum = getSiteCostumContext(ctx);
  if (!costum) return;
  const capable = client as SiteCostumCapableClient;
  if (typeof capable.setSiteCostum !== "function") return;
  capable.setSiteCostum(costum.costumSlug, {
    costumId: costum.costumId,
    costumType: costum.costumType,
  });
}

/**
 * Ajoute le trio costum à la charge utile d'un `callEndpoint` brut — SEULEMENT si le contrat embarqué
 * dans la lib installée déclare `costumSlug` sur cet endpoint.
 *
 * Ce garde-fou n'est pas décoratif : les schémas de requête sont en `additionalProperties:false` et
 * l'ApiClient les valide AVANT l'envoi (AJV). Poser `costumSlug` sur un endpoint dont la version
 * PUBLIÉE ignore encore le champ ferait donc échouer l'appel en `ApiValidationError` — le bouton
 * casserait jusqu'à la publication de la lib. En consultant `getRequestSchema`, le trio n'apparaît
 * que le jour où le contrat l'accepte, sans rien à re-toucher ici.
 */
export function withSiteCostumParams<T extends Record<string, unknown>>(
  client: unknown,
  constant: string,
  payload: T,
  ctx: CostumCarrierCtx = {},
): T {
  const costum = getSiteCostumContext(ctx);
  if (!costum || !client || typeof client !== "object") return payload;
  const capable = client as SiteCostumCapableClient;
  // Règle de référence (lib ≥ 1.0.192) : le MARQUEUR `costumContext` du contrat. Pas « le schéma
  // déclare costumSlug » : 65 endpoints le déclarent avec un sens MÉTIER (variantes costum de la
  // recherche, import, upload), y poser le costum du site changerait leur résultat.
  if (typeof capable.hasCostumContext === "function") {
    return capable.hasCostumContext(constant) ? { ...payload, ...costum } : payload;
  }
  // Repli pour la lib PUBLIÉE 1.0.191, qui n'expose pas le marqueur : on s'en tient au schéma —
  // fermé (additionalProperties:false) sans costumSlug → l'AJV rejetterait, on n'envoie rien ;
  // sinon on pose le trio. Imparfait, mais ne casse aucun appel.
  if (typeof capable.getRequestSchema !== "function") return payload;
  const schema = capable.getRequestSchema(constant) as
    | { properties?: Record<string, unknown>; additionalProperties?: boolean }
    | null
    | undefined;
  const accepte = !!schema?.properties?.costumSlug || schema?.additionalProperties !== false;
  return accepte ? { ...payload, ...costum } : payload;
}
