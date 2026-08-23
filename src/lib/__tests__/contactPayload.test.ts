import { describe, it, expect } from "vitest";
import {
  buildContactPayload,
  fieldRole,
  missingContactRoles,
  type ContactFieldLike,
} from "../contactPayload";

/** Les champs réellement déclarés par les 3 formulaires du parc (aucun `role`). */
const CHAMPS_PARC: ContactFieldLike[] = [
  { name: "name" },
  { name: "email" },
  { name: "phone" },
  { name: "subject" },
  { name: "message" },
  { name: "rgpd" },
];

describe("fieldRole", () => {
  it("déduit le rôle du nom quand `role` n'est pas déclaré", () => {
    expect(fieldRole({ name: "name" })).toBe("senderName");
    expect(fieldRole({ name: "Email" })).toBe("senderEmail");
    expect(fieldRole({ name: "telephone" })).toBe("phone");
    expect(fieldRole({ name: "subject" })).toBe("subject");
    expect(fieldRole({ name: "message" })).toBe("message");
  });

  it("`role` explicite l'emporte sur la convention", () => {
    expect(fieldRole({ name: "message", role: "subject" })).toBe("subject");
  });

  it("un champ hors convention est `extra` (consentement d'interface, non envoyé)", () => {
    expect(fieldRole({ name: "rgpd" })).toBe("extra");
    expect(fieldRole({ name: "newsletter" })).toBe("extra");
  });
});

describe("missingContactRoles", () => {
  it("les 3 formulaires du parc portent tous les rôles requis, sans toucher à leur config", () => {
    expect(missingContactRoles(CHAMPS_PARC)).toEqual([]);
  });

  it("nomme précisément ce qui manque", () => {
    expect(missingContactRoles([{ name: "courriel" }, { name: "message" }])).toEqual([
      "senderName",
      "subject",
    ]);
  });

  it("un nom hors convention se rattrape avec `role`", () => {
    const champs: ContactFieldLike[] = [
      { name: "qui", role: "senderName" },
      { name: "adresse", role: "senderEmail" },
      { name: "objet_du_message", role: "subject" },
      { name: "texte", role: "message" },
    ];
    expect(missingContactRoles(champs)).toEqual([]);
  });
});

describe("buildContactPayload", () => {
  const valeurs = {
    name: "Jean Dupont",
    email: "Jean.Dupont@Example.COM",
    phone: "0692 12 34 56",
    subject: "Information sur un créneau",
    message: "Bonjour, je cherche un créneau le mardi.",
    rgpd: true,
  };

  it("produit la charge utile CONTACT_SEND, destinataire ABSENT", () => {
    const p = buildContactPayload(CHAMPS_PARC, valeurs, "associationEkilibre")!;
    expect(p).toMatchObject({
      costumSlug: "associationEkilibre",
      tpl: "contactForm",
      tplObject: "Information sur un créneau",
      subject: "Information sur un créneau",
      names: "Jean Dupont",
      emailSender: "jean.dupont@example.com",
      replyTo: "jean.dupont@example.com",
    });
    // Le destinataire est résolu SERVEUR : aucune clé d'adressage ne doit sortir du client.
    for (const interdite of ["tplMail", "to", "fromMail"]) {
      expect(p).not.toHaveProperty(interdite);
    }
  });

  it("replie le téléphone dans le corps et la signature (pendant de contactForm.php:953-955)", () => {
    const p = buildContactPayload(CHAMPS_PARC, valeurs, "eki")!;
    expect(p.message).toBe("Bonjour, je cherche un créneau le mardi.\n\nTéléphone : 0692 12 34 56");
    expect(p.sign).toBe("Jean Dupont\nTéléphone : 0692 12 34 56");
  });

  it("sans téléphone, ni corps ni signature ne sont décorés", () => {
    const p = buildContactPayload(CHAMPS_PARC, { ...valeurs, phone: "" }, "eki")!;
    expect(p.message).toBe("Bonjour, je cherche un créneau le mardi.");
    expect(p.sign).toBe("Jean Dupont");
  });

  it("n'envoie PAS les cases de consentement", () => {
    const p = buildContactPayload(CHAMPS_PARC, valeurs, "eki")!;
    expect(JSON.stringify(p)).not.toContain("rgpd");
  });

  it("repli en TEXTE, jamais en HTML (le rendu Node échappe le corps)", () => {
    const p = buildContactPayload(CHAMPS_PARC, valeurs, "eki")!;
    expect(p.message).not.toContain("<br");
    expect(p.sign).not.toContain("<a ");
  });

  it("rend null si un champ requis est vide ou si le slug manque", () => {
    expect(buildContactPayload(CHAMPS_PARC, { ...valeurs, message: "   " }, "eki")).toBeNull();
    expect(buildContactPayload(CHAMPS_PARC, valeurs, "")).toBeNull();
  });
});
