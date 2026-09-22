import { describe, it, expect } from "vitest";
import { COFORM_QUERY_KEYS } from "./queryKeys";

/**
 * `access` (donc `restrictedFields`, `existingAnswer`, `canAnswer`) est calculé
 * serveur-side POUR L'UTILISATEUR COURANT. Le mettre en cache sous une clé sans
 * identité faisait resservir à un admin l'`access` d'un visiteur anonyme —
 * symptôme observé : un input `isAdminOnly` resté invisible pour l'admin de
 * l'organisation parente.
 */
describe("COFORM_QUERY_KEYS.FORM — portée utilisateur", () => {
  it("deux utilisateurs n'ont JAMAIS la même entrée de cache", () => {
    expect(COFORM_QUERY_KEYS.FORM("f1", "userA")).not.toEqual(
      COFORM_QUERY_KEYS.FORM("f1", "userB")
    );
  });

  it("un connecté ne lit pas l'entrée préchargée en SSR", () => {
    // Le préchargement SSR est anonyme : c'est précisément l'entrée qu'un
    // connecté ne doit pas réutiliser.
    expect(COFORM_QUERY_KEYS.FORM("f1", null)).not.toEqual(
      COFORM_QUERY_KEYS.FORM("f1", "userA")
    );
  });

  it("l'anonyme a une clé explicite, jamais un trou", () => {
    // `null` en dernier segment se confondrait visuellement avec un id absent.
    expect(COFORM_QUERY_KEYS.FORM("f1", null)).toEqual(["coform", "form", "f1", "anon"]);
    expect(COFORM_QUERY_KEYS.FORM("f1")).toEqual(["coform", "form", "f1", "anon"]);
  });

  it("FORM_PREFIX reste un PRÉFIXE de FORM — sinon plus rien ne s'invalide", () => {
    // React Query invalide par préfixe de tableau : le préfixe doit rester
    // strictement initial, sans quoi une invalidation ne toucherait plus rien.
    const prefix = COFORM_QUERY_KEYS.FORM_PREFIX("f1");
    for (const user of [null, "userA", "userB"]) {
      const full = COFORM_QUERY_KEYS.FORM("f1", user);
      expect(full.slice(0, prefix.length)).toEqual([...prefix]);
    }
  });

  it("le préfixe global couvre tous les forms et tous les utilisateurs", () => {
    const global = COFORM_QUERY_KEYS.FORM_PREFIX();
    expect(COFORM_QUERY_KEYS.FORM("f9", "userZ").slice(0, global.length)).toEqual([...global]);
  });
});
