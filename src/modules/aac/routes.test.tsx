// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { matchRoutes } from "react-router";
import { QueryClient } from "@tanstack/react-query";
import type { SiteConfig } from "@/types/site-schema";

/** Le document réponse et le formulaire tels que le backend les rend (`serverData`). */
const ANSWER_DOC = { _id: { $id: "6438366673d20a0de1533c77" }, form: "formDeDepot", name: "Une instance peertube" };
const FORM_DOC = { id: "677e7e389058e31575550ac8", name: "Appel test" };
const answer = vi.fn(async () => ({ serverData: ANSWER_DOC }));
const form = vi.fn(async () => ({ serverData: FORM_DOC }));
const initApi = vi.fn(async () => ({ api: { answer, form }, me: null }));
vi.mock("@/lib/apiClient", () => ({ initApi: (...args: unknown[]) => initApi(...(args as [])) }));

import { routes } from "./routes";

/**
 * La factory de routes du module AAC est gatée sur `config.aac` (review MR 53, C2).
 *
 * Le module est `core` : `discoverModules` le charge sur TOUS les sites. Sans le
 * gate, `/aac` et `/aac/commun/:answerId` étaient servies sur les 16 sites du parc
 * qui n'ont pas d'AAC — une page « aucun AAC déclaré » à la place du catch-all.
 * Ce test fige le contrat : pas de `config.aac` ⇒ aucune route ; avec ⇒ les deux.
 */
const ANSWER_ID = "6438366673d20a0de1533c77";
const WITH_AAC = { aac: { formId: "677e7e389058e31575550ac8" } } as unknown as SiteConfig;

const matcher = (url: string, config?: SiteConfig) => matchRoutes(routes(undefined, config), url);

describe("routes du module aac — gate sur config.aac", () => {
  it("sans `config.aac`, la factory ne monte AUCUNE route (config absente ou sans bloc aac)", () => {
    expect(routes(undefined, undefined)).toEqual([]);
    expect(routes(undefined, {} as SiteConfig)).toEqual([]);
    // …donc l'URL n'est capturée par rien : elle tombera sur le catch-all du site.
    expect(matcher("/aac")).toBeNull();
    expect(matcher(`/aac/commun/${ANSWER_ID}`)).toBeNull();
  });

  it("avec `config.aac`, `/aac` est servie", () => {
    expect(matcher("/aac", WITH_AAC)).not.toBeNull();
  });

  it("avec `config.aac`, `/aac/commun/:answerId` est servie et capture l'id", () => {
    const m = matcher(`/aac/commun/${ANSWER_ID}`, WITH_AAC);
    expect(m).not.toBeNull();
    expect(m![m!.length - 1]!.params).toMatchObject({ answerId: ANSWER_ID });
  });

  it("le module n'a jamais exposé `/commun/:id` — la seule fiche est sous `/aac/commun/`", () => {
    // Cible du lien mort de l'ex-`AacCommunList` (review MR 53, H11/H13) : ne pas la « corriger » en
    // ajoutant la route, c'est le lien qui était faux.
    expect(matcher(`/commun/${ANSWER_ID}`, WITH_AAC)).toBeNull();
  });
});

/**
 * La fiche d'un commun est un lien PARTAGEABLE : sans préchargement serveur, ses
 * deux requêtes étaient en chargement au rendu SSR et le `<head>` n'emportait que
 * le SEO de repli. Le loader remplit le cache que la page lira — donc sous SES
 * clés, vérifiées ici en littéral : recopiées de part et d'autre, elles auraient
 * pu diverger sans que rien ne le signale (la page se contentant de refetcher).
 */
describe("routes du module aac — préfetch SSR de la fiche d'un commun", () => {
  /** Le loader tel que le routeur l'appellera. */
  const loaderDe = (queryClient?: QueryClient) => {
    const detail = routes(queryClient, WITH_AAC).find((r) => r.path === "/aac/commun/:answerId");
    return detail?.loader as ((args: { params: Record<string, string> }) => Promise<unknown>) | undefined;
  };

  beforeEach(() => {
    initApi.mockClear();
    answer.mockClear();
    form.mockClear();
  });

  it("précharge la réponse ET le formulaire de L'APPEL COURANT sous les clés de la page", async () => {
    const queryClient = new QueryClient();
    await loaderDe(queryClient)!({ params: { answerId: ANSWER_ID } });

    expect(answer).toHaveBeenCalledWith({ id: ANSWER_ID });
    // `config.aac.formId` prime sur le formulaire de DÉPÔT (`answer.form`) —
    // même règle que `directory.formId ?? originFormId` dans la page.
    expect(form).toHaveBeenCalledWith({ id: WITH_AAC.aac!.formId });
    expect(queryClient.getQueryData(["aac-commun-detail", ANSWER_ID, null])).toEqual(ANSWER_DOC);
    expect(queryClient.getQueryData(["aac-commun-form", WITH_AAC.aac!.formId, null])).toEqual(FORM_DOC);
  });

  it("côté CLIENT (pas de queryClient), le loader ne fetche rien — la page s'en charge", async () => {
    await loaderDe(undefined)!({ params: { answerId: ANSWER_ID } });
    expect(initApi).not.toHaveBeenCalled();
  });

  /** Un backend en panne ne doit pas rendre la route entière indisponible. */
  it("un échec du préfetch reste best-effort : le loader n'explose pas", async () => {
    answer.mockRejectedValueOnce(new Error("backend HS"));
    // `retry: false` : l'échec doit être VU par le loader, pas rattrapé par les
    // trois tentatives par défaut de React Query.
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await expect(loaderDe(queryClient)!({ params: { answerId: ANSWER_ID } })).resolves.toBeNull();
    expect(queryClient.getQueryData(["aac-commun-detail", ANSWER_ID, null])).toBeUndefined();
  });
});
