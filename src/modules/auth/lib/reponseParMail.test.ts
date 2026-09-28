import { describe, it, expect } from "vitest";
import { chargeReponseParMail, lireOptionDeDemande, lireReponse, lireSegment } from "./reponseParMail";

// Reste du chemin après `targetId`, tel qu'askToBecome.php l'émet pour un costum à domaine propre.
const DEMANDE = "linkOption/isAdminPending/key/abc/costumSlug/s/answer/true";
const INVITATION = "costum/true/answer/false";
const BASE = { userId: "u1", targetType: "organizations", targetId: "o1", answer: "true" };

describe("lireSegment", () => {
  it("lit la valeur qui suit chaque segment d'un lien de demande", () => {
    expect(lireSegment(DEMANDE, "linkOption")).toBe("isAdminPending");
    expect(lireSegment(DEMANDE, "key")).toBe("abc");
    expect(lireSegment(DEMANDE, "answer")).toBe("true");
  });

  it("renvoie undefined sur un lien d'invitation, qui n'a ni linkOption ni key", () => {
    expect(lireSegment(INVITATION, "linkOption")).toBeUndefined();
    expect(lireSegment(INVITATION, "key")).toBeUndefined();
    expect(lireSegment(undefined, "key")).toBeUndefined();
  });

  it("lireReponse ne confond pas `/costum/true` avec la réponse", () => {
    expect(lireReponse("costum/true")).toBeUndefined();
    expect(lireReponse(INVITATION)).toBe("false");
  });
});

describe("lireOptionDeDemande", () => {
  it("n'accepte que les deux options de demande connues", () => {
    expect(lireOptionDeDemande("linkOption/toBeValidated/answer/true")).toBe("toBeValidated");
    expect(lireOptionDeDemande("linkOption/isAdminPending/answer/true")).toBe("isAdminPending");
    expect(lireOptionDeDemande("linkOption/isInviting/answer/true")).toBeUndefined();
    expect(lireOptionDeDemande("linkOption/answer/true")).toBeUndefined();
  });
});

describe("chargeReponseParMail", () => {
  it("demande : transmet linkOption et key — sans eux le backend répond à une invitation et n'écrit rien", () => {
    expect(chargeReponseParMail(BASE, DEMANDE)).toEqual({ ...BASE, linkOption: "isAdminPending", key: "abc" });
  });

  it("invitation : exactement les 4 champs historiques", () => {
    expect(chargeReponseParMail(BASE, INVITATION)).toEqual(BASE);
  });

  it("linkOption inconnu : ni linkOption ni key ne partent", () => {
    expect(chargeReponseParMail(BASE, "linkOption/isMember/key/abc/answer/true")).toEqual(BASE);
  });

  it("jamais de clé vide", () => {
    const charge = chargeReponseParMail(BASE, "linkOption/toBeValidated/answer/true");
    expect(charge).toEqual({ ...BASE, linkOption: "toBeValidated" });
    expect(charge).not.toHaveProperty("key");
  });
});
