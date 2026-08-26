/**
 * Traduction d'un formulaire de contact déclaré en config vers la charge utile de l'endpoint
 * `CONTACT_SEND` de la lib (`/co2/mailmanagement/createandsend`).
 *
 * POURQUOI CE MODULE. La section `contactForm` déclare des champs LIBRES (`name`, `email`,
 * `message`…), alors que le legacy attend des clés FIXES (`names`, `emailSender`, `tplObject`,
 * `message`, `sign`). Ce mapping doit vivre dans le code : le mettre en config obligerait chaque
 * site à le refaire à la main, et une faute de frappe y serait invisible.
 *
 * Deux façons de rattacher un champ à son rôle :
 *  1. `field.role` explicite (recommandé pour tout nouveau formulaire) ;
 *  2. à défaut, la CONVENTION de nommage ci-dessous — les 3 formulaires du parc (config.prod,
 *     maison-sport-sante-la-tampon, sport-sante-bien-etre) nomment déjà leurs champs `name`,
 *     `email`, `phone`, `subject`, `message` : ils fonctionnent sans toucher à leur config.
 * Un champ non rattaché (`rgpd`, `newsletter`) est un consentement d'interface : il est validé
 * localement mais n'est PAS envoyé — ce n'est pas du contenu de message.
 */

/** Rôle d'un champ dans le message de contact. */
export type ContactFieldRole =
  | "senderName"
  | "senderEmail"
  | "phone"
  | "subject"
  | "message"
  | "extra";

export interface ContactFieldLike {
  name: string;
  role?: ContactFieldRole;
}

/** Rôles sans lesquels aucun message ne peut être construit (= requis au contrat CONTACT_SEND). */
export const REQUIRED_CONTACT_ROLES: ContactFieldRole[] = [
  "senderName",
  "senderEmail",
  "subject",
  "message",
];

/** Convention de nommage — repli quand `role` n'est pas déclaré. */
const CONVENTION: Record<string, ContactFieldRole> = {
  name: "senderName",
  nom: "senderName",
  fullname: "senderName",
  email: "senderEmail",
  mail: "senderEmail",
  courriel: "senderEmail",
  phone: "phone",
  tel: "phone",
  telephone: "phone",
  subject: "subject",
  objet: "subject",
  message: "message",
};

export function fieldRole(field: ContactFieldLike): ContactFieldRole {
  return field.role ?? CONVENTION[field.name.trim().toLowerCase()] ?? "extra";
}

/** Rôles requis qu'aucun champ ne porte — un formulaire dans ce cas ne peut pas envoyer. */
export function missingContactRoles(fields: ContactFieldLike[]): ContactFieldRole[] {
  const portes = new Set(fields.map(fieldRole));
  return REQUIRED_CONTACT_ROLES.filter((r) => !portes.has(r));
}

/**
 * Charge utile `CONTACT_SEND` (miroir du type généré `ContactSendData`).
 * Déclaré en `type` et non en `interface` : le type généré porte une signature d'index, à laquelle
 * une interface n'est pas assignable (TS ne dérive une signature d'index implicite que pour un alias).
 */
export type ContactPayload = {
  costumSlug: string;
  tpl: "contactForm";
  tplObject: string;
  subject: string;
  names: string;
  emailSender: string;
  message: string;
  replyTo: string;
  sign?: string;
};

/**
 * Construit la charge utile, ou rend `null` si un rôle requis manque / est vide.
 *
 * Le téléphone est REPLIÉ dans le corps et la signature, comme le fait le bloc CMS legacy
 * (`contactForm.php:953-955`) : il n'existe pas de champ dédié côté endpoint. Repli en TEXTE et non
 * en `<br />` : le rendu Node échappe le corps (`mail/templates.ts`, anti-injection), tandis que le
 * template legacy hérite d'un `white-space: pre-line` — le saut de ligne rend correctement des DEUX
 * côtés, la balise non.
 */
export function buildContactPayload(
  fields: ContactFieldLike[],
  values: Record<string, unknown>,
  costumSlug: string,
): ContactPayload | null {
  const parRole = new Map<ContactFieldRole, string>();
  for (const f of fields) {
    const role = fieldRole(f);
    if (role === "extra" || parRole.has(role)) continue;
    const v = values[f.name];
    parRole.set(role, typeof v === "string" ? v.trim() : v == null ? "" : String(v));
  }

  const names = parRole.get("senderName") ?? "";
  const emailSender = (parRole.get("senderEmail") ?? "").toLowerCase();
  const subject = parRole.get("subject") ?? "";
  const messageSaisi = parRole.get("message") ?? "";
  const phone = parRole.get("phone") ?? "";
  if (!costumSlug || !names || !emailSender || !subject || !messageSaisi) return null;

  const message = phone ? `${messageSaisi}\n\nTéléphone : ${phone}` : messageSaisi;
  const sign = phone ? `${names}\nTéléphone : ${phone}` : names;

  return {
    costumSlug,
    tpl: "contactForm",
    tplObject: subject,
    subject,
    names,
    emailSender,
    message,
    replyTo: emailSender,
    sign,
  };
}
