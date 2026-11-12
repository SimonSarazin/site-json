import MarkdownIt from "markdown-it";

/**
 * MAILING D'ADMIN (ADMIN_MAILING_SEND, backend docs/36) — helpers PURS, testés à part.
 *
 * Reprise de l'écran legacy `views/admin/userMailing.php` : l'admin coche des lignes, écrit un objet et un
 * message mis en forme, chaque destinataire reçoit son mail. Deux choix qui diffèrent du legacy, et pourquoi :
 *  - un MEMBRE est désigné par son `_id`, pas par son e-mail : le serveur résout l'adresse
 *    (`Mail::createAndSendSingle` le fait déjà pour un `tplMail` de 24 hex) ; l'e-mail d'une personne n'a pas
 *    à transiter par le navigateur de l'admin, et le backend Node ne le projette d'ailleurs pas aux admins.
 *    Une FICHE (organisation, POI…) est désignée par son e-mail de contact, champ public ;
 *  - le message est saisi en markdown (éditeur du dépôt) et converti ici en HTML borné — le serveur le
 *    nettoie encore en liste blanche.
 */

/** Borne du contrat (`tplMail.maxItems`). */
export const MAX_MAILING_RECIPIENTS = 300;

export interface MailingRecipient {
  /** Clé de sélection (id de la ligne). */
  key: string;
  /** Ce que voit l'admin dans la puce : nom de la personne / de la fiche. */
  label: string;
  /** Ce qui part dans `tplMail[]` : `_id` (24 hex) d'un citoyen, ou e-mail d'une fiche. */
  value: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEX24_RE = /^[a-fA-F0-9]{24}$/; // les deux casses : le legacy résout par ctype_xdigit (oracle F2)

/**
 * Destinataire d'une ligne de table admin / de liste de membres, ou `null` si la ligne n'a rien à
 * joindre (l'écran legacy prévient alors « Cet élément n'a pas d'adresse e-mail »).
 */
export function recipientFromEntity(
  entityType: string | undefined,
  item: { id?: unknown; serverData?: Record<string, unknown> } | null | undefined,
): MailingRecipient | null {
  if (!item) return null;
  const sd = item.serverData ?? {};
  const id = String(item.id ?? sd.id ?? "");
  const label = typeof sd.name === "string" && sd.name ? sd.name : id;
  const collection = entityType || (typeof sd.collection === "string" ? sd.collection : "");
  if (collection === "citoyens") {
    return HEX24_RE.test(id) ? { key: id, label, value: id } : null;
  }
  const email = typeof sd.email === "string" ? sd.email.trim() : "";
  if (!EMAIL_RE.test(email)) return null;
  return { key: id || email, label, value: email.toLowerCase() };
}

/** Dédoublonne sur la VALEUR envoyée (deux fiches peuvent partager un e-mail de contact). */
export function uniqueRecipients(list: MailingRecipient[]): MailingRecipient[] {
  const seen = new Set<string>();
  return list.filter((r) => (seen.has(r.value) ? false : (seen.add(r.value), true)));
}

const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

/**
 * Corps `html` du mail, dans la forme de l'écran legacy : `<h3>objet</h3><br>` + message + `<br>`
 * (userMailing.php:503). Le markdown est rendu SANS HTML brut (`html:false`) : ce que l'admin tape en
 * `<…>` reste du texte.
 */
export function buildMailingHtml(subject: string, markdownBody: string): string {
  const titre = md.renderInline(subject.trim());
  const corps = md.render(markdownBody.trim());
  return `<h3>${titre}</h3><br>${corps}<br>`;
}

/** Texte nu du message (pour savoir s'il est vide malgré la mise en forme). */
export function plainTextOf(markdownBody: string): string {
  return md.render(markdownBody).replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}
