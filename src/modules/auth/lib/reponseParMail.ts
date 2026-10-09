/**
 * Lecture du lien Accepter/Refuser reçu par e-mail (`co2/link/validateinvitationbymail/…`) et charge
 * utile de la réponse — logique pure d'`AcceptInvitationPage`.
 *
 * Le même lien sert deux mails :
 *  - `invitation.php` : l'INVITÉ répond à une invitation (flag `isInviting`) ;
 *  - `askToBecome.php` : un ADMINISTRATEUR tranche la DEMANDE de quelqu'un d'autre (adhésion,
 *    contribution, administration). Ce lien porte en plus `linkOption` et `key`.
 */

/** Les deux options qui font d'un lien une réponse à une DEMANDE — la liste que le backend accepte. */
export const OPTIONS_DE_DEMANDE = ["isAdminPending", "toBeValidated"] as const;
export type OptionDeDemande = (typeof OPTIONS_DE_DEMANDE)[number];

/**
 * Valeur du segment qui SUIT `nom` dans le reste de l'URL, quel que soit l'ordre des segments.
 *
 * Les gabarits de mail collent les suffixes Yii dans un ordre qui n'est pas garanti : un costum à
 * domaine propre émet `…/targetId/<id>/costum/true/answer/true`, une demande
 * `…/linkOption/<opt>/key/<sig>/costumSlug/<slug>/answer/true`. C'est la POSITION APRÈS le segment
 * littéral qui fait foi, jamais la simple présence d'une valeur — `/costum/true` contient lui aussi
 * « true ».
 */
export function lireSegment(reste: string | undefined, nom: string): string | undefined {
  if (!reste) return undefined;
  const seg = reste.split("/").filter(Boolean);
  const i = seg.indexOf(nom);
  return i >= 0 ? seg[i + 1] : undefined;
}

/** La réponse (`true`/`false`) portée par le reste du lien. */
export function lireReponse(reste: string | undefined): string | undefined {
  return lireSegment(reste, "answer");
}

/**
 * `linkOption` du lien s'il désigne une DEMANDE connue, sinon `undefined` (lien d'invitation).
 * Un segment inattendu ne part pas tel quel au backend.
 */
export function lireOptionDeDemande(reste: string | undefined): OptionDeDemande | undefined {
  const option = lireSegment(reste, "linkOption");
  return OPTIONS_DE_DEMANDE.find((o) => o === option);
}

export interface ChargeReponseParMail {
  userId: string;
  targetType: string;
  targetId: string;
  answer: string;
  linkOption?: OptionDeDemande;
  key?: string;
}

/**
 * Charge utile de `VALIDATE_INVITATION_BY_MAIL`.
 *
 * Sur une DEMANDE, `linkOption` et `key` basculent l'action côté backend : sans `linkOption`, elle
 * retombe sur `isInviting`, ne trouve pas ce flag et n'écrit RIEN (la page afficherait « déjà
 * répondu », la demande resterait en attente). `key` est la signature de la demande
 * (`Link::getDemandAnswerKey`) : elle est déjà dans l'URL que l'administrateur a ouverte, on la relaie.
 * Rien n'est ajouté sur un lien d'invitation, et jamais de clé vide : le backend distingue « absent »
 * (invitation) de « présent » (demande).
 */
export function chargeReponseParMail(
  base: { userId: string; targetType: string; targetId: string; answer: string },
  reste: string | undefined,
): ChargeReponseParMail {
  const charge: ChargeReponseParMail = { ...base };
  const linkOption = lireOptionDeDemande(reste);
  if (linkOption) {
    charge.linkOption = linkOption;
    const key = lireSegment(reste, "key");
    if (key) charge.key = key;
  }
  return charge;
}
