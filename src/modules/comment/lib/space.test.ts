import { describe, expect, it } from "vitest";
import { errorCodeOf } from "./discussions";
import {
  belongsToSpace,
  creationErrorCodeOf,
  generalTarget,
  isSpaceType,
  parseCreatedDiscussion,
  parseSpace,
  spaceKey,
  spaceTotals,
  visibleSpaceThreads,
  withDiscussion,
} from "./space";
import type { DiscussionSpace, DiscussionThread, SpaceRef } from "../types";

/**
 * L'espace de discussion d'un commun, côté lecture.
 *
 * Les chemins ci-dessous ont la forme que le legacy écrit en base : c'est elle qui range un fil
 * de formulaire dans l'espace d'UN commun, par son troisième segment.
 */

const COMMUN = "65c3000000000000000000c1";
const AUTRE_COMMUN = "65c3000000000000000000c2";
const APPEL = "65c3000000000000000000f1";
const ETAPE = "65c3000000000000000000e1";

const ESPACE: SpaceRef = { type: "answers", id: COMMUN };

const QUESTION = `${APPEL}.${ETAPE}.${COMMUN}.titre.question_titre.comment`;
const DEPENSE = `${QUESTION.replace(/titre/g, "depense")}.financement.depensekey.aapStep1-depense.depenseindex.1`;
const DISCUSSION = `${APPEL}.moreDiscussions_comite.${COMMUN}.discu_1.comment`;

/** Une ligne telle que le serveur la rend : la forme de `discussions`, plus la nature du fil. */
function ligne(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    key: `answers:${COMMUN}`, contextType: "answers", contextId: COMMUN, path: null, title: null,
    carrier: null, total: 0, unread: 0, last: null, mine: false, virtual: true,
    kind: "general", group: null, audience: null, ...over,
  };
}

const REPONSE = {
  result: true,
  space: { type: "answers", id: COMMUN, title: "Un commun", formId: APPEL },
  canComment: true,
  truncated: false,
  threads: [
    ligne({ total: 3, unread: 1, last: 1_758_000_000, mine: true, virtual: false }),
    ligne({
      key: `forms:${APPEL}:${DISCUSSION}`, contextType: "forms", contextId: APPEL, path: DISCUSSION,
      title: "Comité de sélection", total: 2, unread: 2, last: 1_758_000_100, virtual: false,
      kind: "discussion", audience: "authorAdmin",
    }),
    ligne({
      key: `forms:${APPEL}:${QUESTION}`, contextType: "forms", contextId: APPEL, path: QUESTION,
      title: "Titre du commun", kind: "question", group: "Proposition",
    }),
    ligne({
      key: `forms:${APPEL}:${DEPENSE}`, contextType: "forms", contextId: APPEL, path: DEPENSE,
      title: "Hébergement", total: 1, last: 1_757_000_000, virtual: false,
      kind: "expense", group: "Proposition",
    }),
  ],
};

/** Ce que `parseSpace` lève : on veut l'erreur, pas seulement savoir qu'il y en a une. */
function refusDe(raw: unknown): unknown {
  try { parseSpace(raw); } catch (erreur) { return erreur; }
  return null;
}

function fil(over: Partial<DiscussionThread> = {}): DiscussionThread {
  return {
    key: `answers:${COMMUN}`, target: { type: "answers", id: COMMUN, path: null }, title: null,
    carrier: null, total: 0, unread: 0, last: null, mine: false, virtual: false, kind: "general", ...over,
  };
}

describe("isSpaceType", () => {
  it("ne reconnaît que les éléments qui portent un espace — aujourd'hui le commun", () => {
    expect(isSpaceType("answers")).toBe(true);
    // Un formulaire porte des fils, pas un espace : c'est l'appel, pas le commun.
    expect(isSpaceType("forms")).toBe(false);
    expect(isSpaceType("organizations")).toBe(false);
  });

  it.each([[null], [undefined], [42], [{}], [["answers"]]])("écarte %p sans lever", value => {
    expect(isSpaceType(value)).toBe(false);
  });
});

describe("spaceKey et generalTarget", () => {
  it("rend une clé stable, type puis identifiant", () => {
    expect(spaceKey(ESPACE)).toBe(`answers:${COMMUN}`);
  });

  it("le fil général est celui de l'élément lui-même, sans chemin", () => {
    expect(generalTarget(ESPACE)).toEqual({ type: "answers", id: COMMUN, path: null });
  });
});

describe("belongsToSpace", () => {
  it("retient le fil posé sur le commun lui-même", () => {
    expect(belongsToSpace({ type: "answers", id: COMMUN, path: null }, ESPACE)).toBe(true);
  });

  it("écarte le fil d'un AUTRE commun — l'adresse appartient à tout le site", () => {
    expect(belongsToSpace({ type: "answers", id: AUTRE_COMMUN, path: null }, ESPACE)).toBe(false);
  });

  it("retient un fil posé sur le commun même s'il porte un chemin : l'adresse concerne bien cette fiche", () => {
    // Le serveur ne liste pas ces fils-là — seules les questions de l'appel le sont. Mais dire à
    // quelle fiche une adresse appartient n'est pas dire que son fil existe : la fiche s'ouvre,
    // et c'est la liste qui répond « introuvable ».
    expect(belongsToSpace({ type: "answers", id: COMMUN, path: "aapStep1.titre" }, ESPACE)).toBe(true);
    expect(belongsToSpace({ type: "answers", id: AUTRE_COMMUN, path: "aapStep1.titre" }, ESPACE)).toBe(false);
  });

  it("retient un fil de l'appel dont le chemin porte ce commun en troisième segment", () => {
    for (const path of [QUESTION, DEPENSE, DISCUSSION]) {
      expect(belongsToSpace({ type: "forms", id: APPEL, path }, ESPACE)).toBe(true);
    }
  });

  it("écarte le même fil quand le troisième segment désigne un autre commun", () => {
    const ailleurs = QUESTION.replace(COMMUN, AUTRE_COMMUN);
    expect(belongsToSpace({ type: "forms", id: APPEL, path: ailleurs }, ESPACE)).toBe(false);
  });

  it("n'accepte le commun qu'en TROISIÈME segment, pas ailleurs dans le chemin", () => {
    // Le commun en deuxième segment : ce n'est pas la forme que le legacy écrit.
    const decale = `${APPEL}.${COMMUN}.${ETAPE}.titre.question_titre.comment`;
    expect(belongsToSpace({ type: "forms", id: APPEL, path: decale }, ESPACE)).toBe(false);
  });

  it("exige que le chemin commence par l'appel qu'il dit commenter", () => {
    const autreAppel = "65c3000000000000000000f2";
    expect(belongsToSpace({ type: "forms", id: autreAppel, path: QUESTION }, ESPACE)).toBe(false);
  });

  it("écarte un chemin trop court pour être un fil d'espace — il en faut cinq segments", () => {
    // Quatre segments : il manque de quoi nommer la question ou la discussion.
    const quatre = `${APPEL}.${ETAPE}.${COMMUN}.titre`;
    expect(belongsToSpace({ type: "forms", id: APPEL, path: quatre }, ESPACE)).toBe(false);
    // Cinq suffisent : c'est la longueur d'une discussion supplémentaire.
    expect(belongsToSpace({ type: "forms", id: APPEL, path: `${quatre}.comment` }, ESPACE)).toBe(true);
  });

  it("écarte le fil racine de l'appel, qui n'a pas de chemin", () => {
    expect(belongsToSpace({ type: "forms", id: APPEL, path: null }, ESPACE)).toBe(false);
  });

  it("écarte tout autre type, même si son chemin a la bonne allure", () => {
    expect(belongsToSpace({ type: "news", id: APPEL, path: QUESTION }, ESPACE)).toBe(false);
    expect(belongsToSpace({ type: "organizations", id: COMMUN, path: null }, ESPACE)).toBe(false);
  });

  it("rend faux sans cible, au lieu de lever", () => {
    expect(belongsToSpace(null, ESPACE)).toBe(false);
    expect(belongsToSpace(undefined, ESPACE)).toBe(false);
  });
});

describe("parseSpace", () => {
  it("lit l'espace : son commun, son titre et l'appel où il a été déposé", () => {
    expect(parseSpace(REPONSE).space).toEqual({ type: "answers", id: COMMUN, title: "Un commun", formId: APPEL });
  });

  it("garde les fils dans l'ORDRE du serveur, sans les retrier", () => {
    expect(parseSpace(REPONSE).threads.map(t => t.kind)).toEqual(["general", "discussion", "question", "expense"]);
  });

  it("lit la nature, l'étape et l'audience de chaque fil", () => {
    const [general, discussion, question, depense] = parseSpace(REPONSE).threads;
    expect(general).toMatchObject({ kind: "general", group: null, audience: null, total: 3, unread: 1, mine: true });
    expect(discussion).toMatchObject({ kind: "discussion", audience: "authorAdmin", title: "Comité de sélection" });
    expect(question).toMatchObject({ kind: "question", group: "Proposition", virtual: true });
    expect(depense).toMatchObject({ kind: "expense", group: "Proposition", title: "Hébergement" });
  });

  it("garde la cible complète d'un fil de l'appel, chemin compris — c'est elle qu'on ouvre", () => {
    const question = parseSpace(REPONSE).threads[2];
    expect(question.target).toEqual({ type: "forms", id: APPEL, path: QUESTION });
    expect(question.key).toBe(`forms:${APPEL}:${QUESTION}`);
  });

  it("range « autre » une nature inconnue, au lieu de perdre le fil", () => {
    // Un serveur plus récent que l'écran : le fil reste lisible.
    const { threads } = parseSpace({ ...REPONSE, threads: [ligne({ kind: "sondage" }), ligne({ kind: undefined })] });
    expect(threads.map(t => t.kind)).toEqual(["other", "other"]);
  });

  it("ne retient une audience que si elle est connue", () => {
    const { threads } = parseSpace({
      ...REPONSE,
      threads: [ligne({ audience: "private" }), ligne({ audience: "authorAll" }), ligne({ audience: "tous" })],
    });
    expect(threads.map(t => t.audience)).toEqual(["private", "authorAll", null]);
  });

  it("écarte une ligne inexploitable sans faire tomber les autres", () => {
    const { threads } = parseSpace({
      ...REPONSE,
      threads: [null, "texte", ligne({ contextType: "cities" }), ligne({ contextId: "" }), ligne()],
    });
    expect(threads).toHaveLength(1);
  });

  it("rend une liste vide quand le serveur n'envoie pas de fils", () => {
    expect(parseSpace({ ...REPONSE, threads: undefined }).threads).toEqual([]);
    expect(parseSpace({ ...REPONSE, threads: "aucun" }).threads).toEqual([]);
  });

  it("ne tient `canComment` et `truncated` pour vrais que s'ils le sont strictement", () => {
    expect(parseSpace(REPONSE)).toMatchObject({ canComment: true, truncated: false });
    // Une valeur approchante n'ouvre pas le composer.
    expect(parseSpace({ ...REPONSE, canComment: "true", truncated: 1 })).toMatchObject({ canComment: false, truncated: false });
    expect(parseSpace({ ...REPONSE, canComment: undefined, truncated: true })).toMatchObject({ canComment: false, truncated: true });
  });

  it("remplace un titre ou un appel absents par `null`, jamais par une chaîne vide", () => {
    const { space } = parseSpace({ ...REPONSE, space: { type: "answers", id: COMMUN, title: "  ", formId: undefined } });
    expect(space).toEqual({ type: "answers", id: COMMUN, title: null, formId: null });
  });

  it("lève un refus MARQUÉ et codé — c'est la marque qui évite de le réessayer", () => {
    const erreur = refusDe({ result: false, code: "hidden", msg: "Espace introuvable." }) as { refus?: unknown; code?: unknown };
    expect(erreur.refus).toBe(true);
    expect(erreur.code).toBe("hidden");
    expect(errorCodeOf(erreur)).toBe("hidden");
  });

  it("ne laisse jamais passer le texte du serveur : un code inconnu devient `refused`", () => {
    const erreur = refusDe({ result: false, code: "bad-request", msg: "Type de contexte refusé." });
    expect(errorCodeOf(erreur)).toBe("refused");
    expect((erreur as Error).message).not.toContain("Type de contexte");
  });

  it.each([
    ["sans bloc `space`", { ...REPONSE, space: undefined }],
    ["avec un `space` nul", { ...REPONSE, space: null }],
    ["avec un `space` qui n'est pas un objet", { ...REPONSE, space: `answers:${COMMUN}` }],
    ["avec un type qui ne porte pas d'espace", { ...REPONSE, space: { type: "forms", id: APPEL } }],
    ["sans identifiant", { ...REPONSE, space: { type: "answers", id: "" } }],
    ["avec un identifiant qui n'est pas une chaîne", { ...REPONSE, space: { type: "answers", id: 42 } }],
  ])("tient pour illisible une réponse %s — une panne, sans la marque de refus", (_cas, raw) => {
    const erreur = refusDe(raw);
    expect(errorCodeOf(erreur)).toBe("unreadable");
    expect(erreur).toMatchObject({ refus: false });
  });

  it.each([[null], [undefined], ["texte"], [{}]])("tient %p pour illisible plutôt que d'exploser — sans la marque de refus", raw => {
    const erreur = refusDe(raw);
    expect(errorCodeOf(erreur)).toBe("unreadable");
    expect(erreur).toMatchObject({ refus: false });
  });
});

describe("parseSpace — les audiences qu'on peut donner à une discussion qu'on crée", () => {
  const audiences = (valeur: unknown) => parseSpace({ ...REPONSE, creatableAudiences: valeur }).creatableAudiences;

  it("lit celles que le serveur annonce à CE lecteur", () => {
    expect(audiences(["authorAll", "authorAdmin"])).toEqual(["authorAll", "authorAdmin"]);
    expect(audiences(["authorAll", "authorAdmin", "private"])).toEqual(["authorAll", "authorAdmin", "private"]);
  });

  it("les rend dans l'ordre de l'écran, quel que soit celui du serveur", () => {
    expect(audiences(["private", "authorAll"])).toEqual(["authorAll", "private"]);
  });

  it("aucune pour un serveur qui n'en dit rien — on ne propose pas de créer", () => {
    expect(parseSpace(REPONSE).creatableAudiences).toEqual([]);
    expect(audiences([])).toEqual([]);
    expect(audiences(null)).toEqual([]);
    expect(audiences("authorAll")).toEqual([]);
    expect(audiences({ authorAll: true })).toEqual([]);
  });

  it("n'en propose pas une que l'écran ne connaît pas : il ne saurait pas dire à qui elle ouvre", () => {
    expect(audiences(["juryOnly", "authorAdmin", true, null])).toEqual(["authorAdmin"]);
  });
});

/**
 * La réponse de `creatediscussion`. Un refus y est le CORPS que le serveur rend en HTTP 200 — que
 * l'appelant a repris de l'exception du SDK avant d'arriver ici.
 */
describe("parseCreatedDiscussion", () => {
  const CHEMIN = `${APPEL}.moreDiscussions_93015AbCdEfGh.${COMMUN}.discu_121020269301512.commentPublic`;
  const CREEE = ligne({
    key: `forms:${APPEL}:${CHEMIN}`, contextType: "forms", contextId: APPEL, path: CHEMIN,
    title: "Budget 2026", kind: "discussion", audience: "authorAll",
  });
  const erreurDe = (raw: unknown): unknown => {
    try { parseCreatedDiscussion(raw); } catch (erreur) { return erreur; }
    return null;
  };

  it("lit le fil créé : une discussion vide, avec sa cible, son titre et son audience", () => {
    expect(parseCreatedDiscussion({ result: true, thread: CREEE })).toEqual({
      key: `forms:${APPEL}:${CHEMIN}`, target: { type: "forms", id: APPEL, path: CHEMIN }, title: "Budget 2026",
      carrier: null, total: 0, unread: 0, last: null, mine: false, virtual: true,
      kind: "discussion", group: null, audience: "authorAll",
    });
  });

  it.each(["login", "hidden", "forbidden", "bad-name", "too-many"])("rend le refus `%s` par son code — jamais le texte du serveur", code => {
    const erreur = erreurDe({ result: false, code, msg: "Texte du serveur." });
    expect(erreur).toBeInstanceOf(Error);
    expect(creationErrorCodeOf(erreur)).toBe(code);
    expect((erreur as Error).message).not.toContain("Texte du serveur");
  });

  it.each([["failed"], ["bad-request"], ["un-code-de-demain"], [undefined], [42]])(
    "un refus de code %p se dit « n'a pas pu être créée »", code => {
      expect(creationErrorCodeOf(erreurDe({ result: false, code }))).toBe("failed");
    });

  it.each([
    ["sans fil", { result: true }],
    ["avec un fil qui n'en est pas un", { result: true, thread: "discu_1" }],
    ["avec un fil d'une autre nature", { result: true, thread: { ...CREEE, kind: "question" } }],
    ["avec un fil sans chemin", { result: true, thread: { ...CREEE, path: null } }],
    ["qui n'est pas un objet", "<html>Maintenance</html>"],
    ["vide", null],
    ["sans `result`", { thread: CREEE }],
  ])("une réponse %s est ILLISIBLE : on ne sait pas si la discussion existe", (_cas, raw) => {
    expect(creationErrorCodeOf(erreurDe(raw))).toBe("unreadable");
  });

  it("une erreur venue d'ailleurs — réseau, schéma — se dit « n'a pas pu être créée »", () => {
    expect(creationErrorCodeOf(new Error("Network Error"))).toBe("failed");
    expect(creationErrorCodeOf({ code: "forbidden" })).toBe("failed");
    expect(creationErrorCodeOf({ creation: "oui", code: "forbidden" })).toBe("failed");
    expect(creationErrorCodeOf({ creation: true })).toBe("failed");
    expect(creationErrorCodeOf(null)).toBe("failed");
  });
});

describe("withDiscussion", () => {
  const discussion = (cle: string, titre: string | null) => fil({
    key: `forms:${APPEL}:${cle}`, target: { type: "forms", id: APPEL, path: cle }, title: titre, kind: "discussion", virtual: true,
  });
  const question = fil({ key: "q", target: { type: "forms", id: APPEL, path: QUESTION }, title: "Aaa", kind: "question" });
  const general = fil();
  const espace = (...threads: DiscussionThread[]): DiscussionSpace => ({
    space: { type: "answers", id: COMMUN, title: null, formId: APPEL },
    threads, canComment: true, creatableAudiences: ["authorAll", "authorAdmin"], truncated: false,
  });
  const cles = (e: DiscussionSpace) => e.threads.map(thread => thread.key.replace(`forms:${APPEL}:`, ""));

  it("la range parmi les discussions, par titre — après le fil général, avant les questions", () => {
    const avant = espace(general, discussion("b", "Budget"), discussion("z", "Zoo"), question);
    expect(cles(withDiscussion(avant, discussion("n", "Nouvelle")))).toEqual([`answers:${COMMUN}`, "b", "n", "z", "q"]);
    expect(cles(withDiscussion(avant, discussion("a", "Avis")))).toEqual([`answers:${COMMUN}`, "a", "b", "z", "q"]);
    expect(cles(withDiscussion(avant, discussion("y", "Zut")))).toEqual([`answers:${COMMUN}`, "b", "z", "y", "q"]);
  });

  it("sans la casse ni les accents, comme le serveur : « État » se range à E", () => {
    const avant = espace(general, discussion("b", "Budget"), discussion("z", "Zoo"), question);
    expect(cles(withDiscussion(avant, discussion("e", "État des lieux")))).toEqual([`answers:${COMMUN}`, "b", "e", "z", "q"]);
    expect(cles(withDiscussion(avant, discussion("m", "budget")))[2]).toBe("m");
  });

  it("à titre égal, le chemin départage", () => {
    const avant = espace(general, discussion("b", "Budget"), discussion("d", "Budget"), question);
    expect(cles(withDiscussion(avant, discussion("c", "Budget")))).toEqual([`answers:${COMMUN}`, "b", "c", "d", "q"]);
  });

  it("première discussion d'un commun : juste après le fil général", () => {
    expect(cles(withDiscussion(espace(general, question), discussion("n", "Nouvelle")))).toEqual([`answers:${COMMUN}`, "n", "q"]);
    expect(cles(withDiscussion(espace(general), discussion("n", "Nouvelle")))).toEqual([`answers:${COMMUN}`, "n"]);
  });

  it("déjà dans la liste, elle est remplacée — jamais doublée", () => {
    const avant = espace(general, discussion("b", "Budget"), discussion("n", "Ancien titre"), question);
    const apres = withDiscussion(avant, discussion("n", "Nouvelle"));
    expect(cles(apres)).toEqual([`answers:${COMMUN}`, "b", "n", "q"]);
    expect(apres.threads[2].title).toBe("Nouvelle");
  });

  it("rend un NOUVEL espace : la liste en cache n'est pas modifiée en place", () => {
    const avant = espace(general, question);
    const fils = avant.threads;
    const apres = withDiscussion(avant, discussion("n", "Nouvelle"));
    expect(apres).not.toBe(avant);
    expect(avant.threads).toBe(fils);
    expect(avant.threads).toHaveLength(2);
    // Le reste de l'espace suit tel quel.
    expect(apres).toMatchObject({ canComment: true, creatableAudiences: ["authorAll", "authorAdmin"], truncated: false });
  });
});

describe("spaceTotals", () => {
  it("additionne les messages et les non-lus de tous les fils", () => {
    expect(spaceTotals(parseSpace(REPONSE).threads)).toEqual({ total: 6, unread: 3 });
  });

  it("rend zéro sur un espace sans fil", () => {
    expect(spaceTotals([])).toEqual({ total: 0, unread: 0 });
  });
});

describe("visibleSpaceThreads", () => {
  const GENERAL_VIERGE = fil({ virtual: true });
  const QUESTION_VIERGE = fil({ key: "q1", kind: "question", virtual: true });
  const QUESTION_COMMENTEE = fil({ key: "q2", kind: "question", total: 2 });
  const DISCUSSION_VIERGE = fil({ key: "d1", kind: "discussion", virtual: true, audience: "authorAll" });
  const TOUS = [GENERAL_VIERGE, DISCUSSION_VIERGE, QUESTION_VIERGE, QUESTION_COMMENTEE];

  it("montre tout à qui peut écrire, emplacements vides compris", () => {
    expect(visibleSpaceThreads(TOUS, true)).toEqual(TOUS);
  });

  it("retire les emplacements vides à qui ne peut pas écrire — il n'a rien à y démarrer", () => {
    expect(visibleSpaceThreads(TOUS, false).map(t => t.key)).toEqual([GENERAL_VIERGE.key, QUESTION_COMMENTEE.key]);
  });

  it("garde le fil général même vide : c'est là qu'on arrive, et qu'on est invité à se connecter", () => {
    expect(visibleSpaceThreads([GENERAL_VIERGE], false)).toEqual([GENERAL_VIERGE]);
  });

  it("garde l'ordre reçu", () => {
    const inverse = [QUESTION_COMMENTEE, GENERAL_VIERGE];
    expect(visibleSpaceThreads(inverse, false)).toEqual(inverse);
  });
});
