// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { matchRoutes } from "react-router";

import { routes } from "../routes";

/**
 * Les liens de validation des e-mails DÉJÀ ENVOYÉS doivent résoudre sur
 * site-json quand le domaine d'un costum y pointe (cf.
 * cocolight-backend/docs/23-EMAILS-LIENS-ACTIVATION.md).
 *
 * Deux formes en circulation :
 *  - backend Node : /validate/<id>/<sha256(id+email)>            (person.routes.ts)
 *  - legacy PHP   : /co2/person/activate/user/<id>/validationKey/<key>
 *    + suffixes Yii OPTIONNELS /costum/true, /redirect/<url pointée>, /toredirect/…
 *    (views/emails/validation.php)
 *
 * Ce test fige le contrat d'URL : si une route bouge, ce sont des e-mails déjà
 * partis qui tombent en 404 — d'où la vérification sur des liens réels.
 */
const ID = "6a756553a27baaaea9912ea7";
const KEY = "098554de06f8db5bdb4fca253de3eb0d7196c472e3da6b7071c0d7ec36f154cc";

// config optionnelle : le flux de reset par CODE (/recover/:user/:code) n'est servi qu'en mode Node.
const matcher = (url: string, config?: unknown) =>
  matchRoutes(routes(undefined as never, config as never) ?? [], url);
const NODE_CFG = { auth: { recover: { mode: "node" } } };

describe("routes de validation de compte (liens d'e-mails)", () => {
  it("forme backend Node : /validate/:user/:validationKey", () => {
    const m = matcher(`/validate/${ID}/${KEY}`);
    expect(m).not.toBeNull();
    expect(m![m!.length - 1]!.params).toMatchObject({ user: ID, validationKey: KEY });
  });

  it("forme Node dégradée (clé absente — costumHooks émet /validate/<id> seul)", () => {
    const m = matcher(`/validate/${ID}`);
    expect(m).not.toBeNull();
    expect(m![m!.length - 1]!.params.user).toBe(ID);
  });

  it("forme LEGACY nue", () => {
    const m = matcher(`/co2/person/activate/user/${ID}/validationKey/${KEY}`);
    expect(m).not.toBeNull();
    expect(m![m!.length - 1]!.params).toMatchObject({ user: ID, validationKey: KEY });
  });

  it("forme LEGACY d'un costum à domaine propre (suffixe /costum/true)", () => {
    const m = matcher(`/co2/person/activate/user/${ID}/validationKey/${KEY}/costum/true`);
    expect(m).not.toBeNull();
    expect(m![m!.length - 1]!.params).toMatchObject({ user: ID, validationKey: KEY });
  });

  it("forme LEGACY avec /redirect/<url pointée> (les / de l'URL sont des points)", () => {
    // str_replace('/', '.', $url) côté legacy → le segment commence par un point.
    const m = matcher(
      `/co2/person/activate/user/${ID}/validationKey/${KEY}/redirect/.costum.co.index.slug.ctenat`,
    );
    expect(m).not.toBeNull();
    expect(m![m!.length - 1]!.params).toMatchObject({ user: ID, validationKey: KEY });
  });

  it("récupération par CODE (mode Node opt-in) : /recover/:user/:code est servie", () => {
    const CODE = "d7c8c34ef2ef88bb3b2bd3c5f419d8383bfb6d1262dc0463";
    const m = matcher(`/recover/${ID}/${CODE}`, NODE_CFG);
    expect(m).not.toBeNull();
    expect(m![m!.length - 1]!.params).toMatchObject({ user: ID, code: CODE });
  });

  it("défaut LEGACY : /recover/:user/:code n'est PAS servie (le legacy régénère le mdp, aucun lien à code)", () => {
    const CODE = "d7c8c34ef2ef88bb3b2bd3c5f419d8383bfb6d1262dc0463";
    // sans config (défaut legacy), la route de saisie du nouveau mdp n'existe pas → aucune capture.
    expect(matcher(`/recover/${ID}/${CODE}`)).toBeNull();
    // …mais la DEMANDE (/recover-password) reste servie dans les deux modes.
    expect(matcher("/recover-password")).not.toBeNull();
  });

  it("lien d'invitation partageable : /co2/link/connect/ref/:ref (docs/25)", () => {
    // La même URL que le legacy PHP — les liens costum.invitationLink déjà diffusés doivent
    // résoudre quand le domaine du costum pointe sur site-json.
    const REF = "cde83b0497b173e09fe30f8f";
    const m = matcher(`/co2/link/connect/ref/${REF}`);
    expect(m).not.toBeNull();
    expect(m![m!.length - 1]!.params).toMatchObject({ ref: REF });
  });

  it("lien d'INVITATION (passerelle) : /co2/person/validateinvitation/user/:user/validationKey/:validationKey (+ /invitation/1, /costum/true)", () => {
    for (const suffix of ["", "/invitation/1", "/invitation/1/costum/true"]) {
      const m = matcher(`/co2/person/validateinvitation/user/${ID}/validationKey/${KEY}${suffix}`);
      expect(m, suffix).not.toBeNull();
      expect(m![m!.length - 1]!.params).toMatchObject({ user: ID, validationKey: KEY });
    }
  });

  it("réponse Accepter/Refuser d'invitation : /co2/link/validateinvitationbymail/userId/:userId/…/answer/:answer (+ suffixes Yii)", () => {
    const TID = "5f8d0a1b2c3d4e5f60718293";
    for (const answer of ["true", "false"]) {
      for (const suffix of ["", "/costum/true", "/redirect/.costum.co.index.slug.ctenat"]) {
        const m = matcher(
          `/co2/link/validateinvitationbymail/userId/${ID}/targetType/organizations/targetId/${TID}/answer/${answer}${suffix}`,
        );
        expect(m, `${answer}${suffix}`).not.toBeNull();
        expect(m![m!.length - 1]!.params).toMatchObject({ userId: ID, targetType: "organizations", targetId: TID, answer });
      }
    }
  });

  it("les routes auth historiques restent servies (dont /recover-password, distinct de /recover/…)", () => {
    for (const p of ["/login", "/register", "/recover-password"]) {
      expect(matcher(p), p).not.toBeNull();
    }
    // garde-fou : /recover-password ne doit PAS être capturé par /recover/:user/:code
    const m = matcher("/recover-password");
    expect(m![m!.length - 1]!.params).toEqual({});
  });
});
