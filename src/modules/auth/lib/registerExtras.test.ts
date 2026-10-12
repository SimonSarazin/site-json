/**
 * Champs supplémentaires d'inscription (docs/33 étape 5) — fonctions pures + appel `register`.
 * Ce qui est verrouillé : un champ masqué par `showIf` n'est ni exigé ni ENVOYÉ (une précision
 * orpheline ne doit jamais atteindre le serveur), et l'appel reste byte-identique à l'ancien quand
 * ni `mode` ni `fields` ne sont posés.
 */
import { describe, it, expect, vi } from "vitest";
import type { UserApi } from "@communecter/cocolight-api-client";
import type { RegisterFieldConfig } from "../schema";
import {
  collectRegisterFields, firstMissingRequiredField, visibleRegisterFields, registerWithExtras,
} from "./registerExtras";

const typepro: RegisterFieldConfig = {
  name: "typepro", label: { fr: "Profession" }, widget: "select", required: true,
  options: [{ value: "Médecins", label: { fr: "Médecins" } }, { value: "autres", label: { fr: "Autres" } }],
};
const others: RegisterFieldConfig = {
  name: "othersTypepro", label: { fr: "Précisez" }, widget: "text", required: true,
  showIf: { field: "typepro", equals: "autres" },
};
const FIELDS = [typepro, others];

describe("visibleRegisterFields / firstMissingRequiredField", () => {
  it("othersTypepro n'apparaît que si typepro === autres", () => {
    expect(visibleRegisterFields(FIELDS, {}).map((f) => f.name)).toEqual(["typepro"]);
    expect(visibleRegisterFields(FIELDS, { typepro: "Médecins" }).map((f) => f.name)).toEqual(["typepro"]);
    expect(visibleRegisterFields(FIELDS, { typepro: "autres" }).map((f) => f.name)).toEqual(["typepro", "othersTypepro"]);
  });

  it("required ne vaut que pour un champ visible ; les espaces ne comptent pas", () => {
    expect(firstMissingRequiredField(FIELDS, {})?.name).toBe("typepro");
    expect(firstMissingRequiredField(FIELDS, { typepro: "Médecins" })).toBeUndefined();
    expect(firstMissingRequiredField(FIELDS, { typepro: "autres" })?.name).toBe("othersTypepro");
    expect(firstMissingRequiredField(FIELDS, { typepro: "autres", othersTypepro: "   " })?.name).toBe("othersTypepro");
    expect(firstMissingRequiredField(FIELDS, { typepro: "autres", othersTypepro: "Ostéopathe" })).toBeUndefined();
    expect(firstMissingRequiredField(undefined, {})).toBeUndefined();
  });
});

describe("collectRegisterFields", () => {
  it("n'envoie que les valeurs non vides des champs visibles", () => {
    expect(collectRegisterFields(FIELDS, {})).toEqual({});
    expect(collectRegisterFields(FIELDS, { typepro: "Médecins" })).toEqual({ typepro: "Médecins" });
    expect(collectRegisterFields(FIELDS, { typepro: "autres", othersTypepro: " Ostéopathe " }))
      .toEqual({ typepro: "autres", othersTypepro: "Ostéopathe" });
  });

  it("une précision saisie puis MASQUÉE (typepro changé) n'est pas envoyée", () => {
    expect(collectRegisterFields(FIELDS, { typepro: "Médecins", othersTypepro: "Ostéopathe" })).toEqual({ typepro: "Médecins" });
  });
});

describe("registerWithExtras", () => {
  const api = () => {
    const register = vi.fn(async () => ({ result: true }));
    return { register, userApi: { register } as unknown as UserApi };
  };
  const base = { name: "Jean", username: "jean", email: "j@x.re", pwd: "secret1", costumSlug: "sportSanteBienetre" };

  it("sans mode ni fields : appel strictement identique à l'inscription d'avant", async () => {
    const { register, userApi } = api();
    await registerWithExtras(userApi, { ...base, fields: {} });
    expect(register).toHaveBeenCalledWith(base);
  });

  it("mode + fields posés quand fournis", async () => {
    const { register, userApi } = api();
    await registerWithExtras(userApi, { ...base, mode: "single_step_register", fields: { typepro: "Médecins" } });
    expect(register).toHaveBeenCalledWith({ ...base, mode: "single_step_register", fields: { typepro: "Médecins" } });
  });

  it("relaie la réponse brute (result/msg) du serveur", async () => {
    const register = vi.fn(async () => ({ result: false, msg: "Contenu Invalide foo : Person" }));
    const res = await registerWithExtras({ register } as unknown as UserApi, { ...base, fields: { foo: "bar" } });
    expect(res).toEqual({ result: false, msg: "Contenu Invalide foo : Person" });
  });
});
