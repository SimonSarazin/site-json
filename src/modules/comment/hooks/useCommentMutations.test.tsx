// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Comment, EntityTypes } from "@communecter/cocolight-api-client";
import { CocolightContext, type CocolightContextType } from "@/contexts/CocolightContext";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { useCommentMutations } from "./useCommentMutations";
import type { CommentThreadData } from "./useCommentsQuery";
import { COMMENT_QUERY_KEYS } from "../constants/queryKeys";
import { toCommentTree } from "../lib/commentTree";
import type { CommentNode, CommentTarget } from "../types";

/**
 * Conduite du cache lors d'une écriture.
 *
 * Ces tests ne valident PAS le SDK — c'est le rôle de la sonde réseau, qui appelle le vrai
 * backend. Ils valident ce qui est réellement en question ici : ce que devient le fil affiché
 * quand une écriture réussit, échoue franchement, ou échoue **après avoir peut-être écrit**
 * (le cas B8, où le commentaire est inséré puis la notification lève un 500).
 */

const toastSpies = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));

// `sonner` est une frontière d'affichage : ce qui compte est de savoir LEQUEL des trois
// registres a été employé — un échec franc et un « peut-être écrit » ne se disent pas pareil.
vi.mock("sonner", () => ({ toast: toastSpies }));

const TARGET: CommentTarget = { type: "organizations", id: "a".repeat(24), path: null };
const ME_ID = "b".repeat(24);
const ROOT_ID = "c".repeat(24);

/** Un fil d'un seul message — et, au besoin, ses réponses. */
function makeThread(replyCount = 0): { data: CommentThreadData; instances: Map<string, Comment> } {
  const nodes = toCommentTree(
    [{
      id: ROOT_ID,
      text: "message d'origine",
      created: 1_700_000_000,
      author: { id: ME_ID, name: "Moi" },
      replies: Array.from({ length: replyCount }, (_, i) => ({
        id: `r${i}`.padEnd(24, "0"),
        text: `réponse ${i}`,
        created: 1_700_000_100 + i,
        author: { id: ME_ID, name: "Moi" },
      })),
    }],
    { meId: ME_ID },
  );
  const instances = new Map<string, Comment>();
  return { data: { nodes, index: instances, host: null }, instances };
}

function failure(status: number) {
  return Object.assign(new Error("échec simulé"), { status });
}

interface SetupOptions {
  /** Ce que fait `save()` du brouillon créé — succès par défaut. */
  readonly onSave?: () => Promise<void>;
  readonly onDelete?: () => Promise<void>;
  readonly onVote?: () => Promise<void>;
  readonly onCountChange?: (delta: number) => void;
  readonly onSendFailed?: (draft: { text: string; mentions: readonly unknown[]; parentId: string | null }) => void;
  /** Nombre de réponses sous le message racine. */
  readonly withReplies?: number;
}

function setup(options: SetupOptions = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const { data, instances } = makeThread(options.withReplies ?? 0);
  const threadKey = COMMENT_QUERY_KEYS.THREAD(TARGET, null);
  queryClient.setQueryData<CommentThreadData>(threadKey, data);

  const created = {
    id: "d".repeat(24),
    save: vi.fn(options.onSave ?? (async () => {})),
  };
  const entity = { comment: vi.fn(async () => created) } as unknown as EntityTypes;

  // L'instance du message racine : seule capable d'écrire sur lui (édition, suppression, vote).
  const rootInstance = {
    id: ROOT_ID,
    data: { text: "message d'origine" } as Record<string, unknown>,
    save: vi.fn(options.onSave ?? (async () => {})),
    delete: vi.fn(options.onDelete ?? (async () => {})),
    addVote: vi.fn(options.onVote ?? (async () => {})),
    comment: vi.fn(async () => created),
  };
  instances.set(ROOT_ID, rootInstance as unknown as Comment);

  const cocolight = {
    me: { id: ME_ID, serverData: { name: "Moi" } },
    api: null,
    helper: {},
  } as unknown as CocolightContextType;

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        CocolightContext.Provider,
        { value: cocolight },
        createElement(LocalizationProvider, null, children),
      ),
    );

  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

  const { result } = renderHook(
    () => useCommentMutations({
      target: TARGET,
      entity,
      index: instances,
      onCountChange: options.onCountChange,
      onSendFailed: options.onSendFailed,
    }),
    { wrapper },
  );

  const nodesNow = () => queryClient.getQueryData<CommentThreadData>(threadKey)?.nodes ?? [];

  return { result, queryClient, threadKey, nodesNow, initialNodes: data.nodes, created, entity, rootInstance, invalidateSpy };
}

/** Les invalidations portant sur la famille de clés donnée. */
function invalidationsOn(calls: readonly unknown[][], family: string) {
  return calls.filter(call => {
    const key = (call[0] as { queryKey?: unknown[] } | undefined)?.queryKey;
    return Array.isArray(key) && key[0] === family;
  });
}

beforeEach(() => {
  toastSpies.success.mockClear();
  toastSpies.error.mockClear();
  toastSpies.warning.mockClear();
});

describe("useCommentMutations — ajout", () => {
  it("affiche le message avant la réponse du serveur, en le marquant en cours d'envoi", async () => {
    const { result, nodesNow } = setup({ onSave: () => new Promise(() => {}) });

    result.current.add.mutate({ text: "bonjour" });

    await waitFor(() => expect(nodesNow()).toHaveLength(2));
    const optimistic = nodesNow()[1] as CommentNode;
    expect(optimistic.text).toBe("bonjour");
    expect(optimistic.pending).toBe(true);
    expect(optimistic.author.id).toBe(ME_ID);
  });

  it("remplace l'identifiant provisoire par celui du serveur et compte le message", async () => {
    const onCountChange = vi.fn();
    const { result, nodesNow, created } = setup({ onCountChange });

    result.current.add.mutate({ text: "bonjour" });

    await waitFor(() => expect(result.current.add.isSuccess).toBe(true));
    const posted = nodesNow()[1] as CommentNode;
    expect(posted.id).toBe(created.id);
    expect(posted.pending).toBeUndefined();
    expect(onCountChange).toHaveBeenCalledExactlyOnceWith(1);
    expect(toastSpies.success).toHaveBeenCalled();
  });

  it("annule vraiment l'ajout sur un refus franc — c'est ce que l'implémentation news ne faisait pas", async () => {
    const onCountChange = vi.fn();
    const { result, nodesNow, initialNodes } = setup({
      onSave: async () => { throw failure(400); },
      onCountChange,
    });

    result.current.add.mutate({ text: "bonjour" });

    await waitFor(() => expect(result.current.add.isError).toBe(true));
    // Égalité de CONTENU, pas de référence : React Query applique le partage structurel en
    // reposant l'instantané. Ce qui est prouvé ici reste le point en litige — l'instantané
    // restauré n'a pas été modifié entre-temps.
    expect(nodesNow()).toStrictEqual(initialNodes);
    expect(nodesNow()).toHaveLength(1);
    expect(onCountChange).not.toHaveBeenCalled();
    expect(toastSpies.error).toHaveBeenCalled();
    expect(toastSpies.warning).not.toHaveBeenCalled();
  });

  it("rend le brouillon d'un envoi refusé : le texte tapé n'est plus perdu (revue du 29/09)", async () => {
    const onSendFailed = vi.fn();
    const { result, nodesNow, initialNodes } = setup({ onSave: async () => { throw failure(400); }, onSendFailed });

    result.current.add.mutate({ text: "bonjour" });

    await waitFor(() => expect(result.current.add.isError).toBe(true));
    // L'ajout reste annulé pour de bon…
    expect(nodesNow()).toStrictEqual(initialNodes);
    // … mais son texte revient à l'appelant, qui le remet dans le composer.
    expect(onSendFailed).toHaveBeenCalledExactlyOnceWith({ text: "bonjour", mentions: [], parentId: null });
    // La description dit le brouillon rendu (clé brute ici : ce fichier ne charge pas le bundle).
    const appels = toastSpies.error.mock.calls;
    expect(String((appels[appels.length - 1]?.[1] as { description?: unknown } | undefined)?.description))
      .toMatch(/draftRestored|revenu dans le champ/);
  });

  it("ne rend RIEN quand l'envoi a peut-être abouti : le fil relu dira la vérité", async () => {
    const onSendFailed = vi.fn();
    const { result } = setup({ onSave: async () => { throw failure(500); }, onSendFailed });

    result.current.add.mutate({ text: "bonjour" });

    await waitFor(() => expect(result.current.add.isError).toBe(true));
    expect(onSendFailed).not.toHaveBeenCalled();
  });

  /**
   * Le fil et le PANNEAU sont deux caches distincts.
   *
   * Sans cette invalidation, les colonnes « espaces » et « fils » n'apprenaient le nouveau
   * message que du temps réel — absent de tout déploiement sans hub, donc de tout le
   * développement local — ou au prochain rafraîchissement automatique, jusqu'à 30 secondes
   * plus tard. On voyait son propre message dans le fil pendant que la colonne d'à côté
   * annonçait encore l'ancien compte.
   */
  it("périme AUSSI les compteurs du panneau, et pas seulement le fil", async () => {
    const { result, invalidateSpy } = setup();

    result.current.add.mutate({ text: "bonjour" });

    await waitFor(() => expect(result.current.add.isSuccess).toBe(true));
    expect(invalidationsOn(invalidateSpy.mock.calls, "comment-discussions").length)
      .toBeGreaterThan(0);
    // Le fil reste invalidé lui aussi : l'un ne remplace pas l'autre.
    expect(invalidationsOn(invalidateSpy.mock.calls, "comment-thread").length)
      .toBeGreaterThan(0);
  });

  it("sur un 500, relit le fil au lieu de conclure à l'échec (bug B8)", async () => {
    const { result, invalidateSpy } = setup({ onSave: async () => { throw failure(500); } });

    result.current.add.mutate({ text: "bonjour" });

    await waitFor(() => expect(result.current.add.isError).toBe(true));
    expect(invalidationsOn(invalidateSpy.mock.calls, "comment-thread").length).toBeGreaterThan(0);
    expect(toastSpies.warning).toHaveBeenCalled();
    expect(toastSpies.error).not.toHaveBeenCalled();
  });
});

describe("useCommentMutations — réponse", () => {
  it("place la réponse sous son parent, puis la confirme", async () => {
    const { result, nodesNow, created } = setup();

    result.current.reply.mutate({ parentId: ROOT_ID, text: "et voilà" });

    await waitFor(() => expect(result.current.reply.isSuccess).toBe(true));
    const replies = (nodesNow()[0] as CommentNode).replies;
    expect(replies).toHaveLength(1);
    expect(replies[0]?.id).toBe(created.id);
    expect(replies[0]?.text).toBe("et voilà");
  });

  it("n'écrit jamais dans l'instantané — le défaut exact de `commentCacheUtils`", async () => {
    const { result, initialNodes } = setup({ onSave: async () => { throw failure(400); } });
    const parentAvant = initialNodes[0] as CommentNode;

    result.current.reply.mutate({ parentId: ROOT_ID, text: "réponse qui échoue" });

    await waitFor(() => expect(result.current.reply.isError).toBe(true));
    // L'ancienne implémentation poussait la réponse DANS `serverData.replies` du parent :
    // l'objet gardé pour le rollback portait donc déjà la réponse, et restaurer ne restaurait
    // rien. Ici, l'objet d'origine est intact — c'est vérifié sur SA référence, que le partage
    // structurel de React Query ne peut pas expliquer.
    expect(parentAvant.replies).toHaveLength(0);
  });

  it("échoue proprement quand le message parent n'est pas dans le fil chargé", async () => {
    const { result } = setup();

    result.current.reply.mutate({ parentId: "e".repeat(24), text: "orphelin" });

    await waitFor(() => expect(result.current.reply.isError).toBe(true));
    expect(toastSpies.error).toHaveBeenCalled();
  });
});

describe("useCommentMutations — modification et suppression", () => {
  it("modifie le texte tout de suite, et le restaure si le serveur refuse", async () => {
    const { result, nodesNow, initialNodes } = setup({ onSave: async () => { throw failure(403); } });

    result.current.edit.mutate({ commentId: ROOT_ID, text: "texte corrigé" });

    await waitFor(() => expect(result.current.edit.isError).toBe(true));
    expect(nodesNow()).toStrictEqual(initialNodes);
    expect((nodesNow()[0] as CommentNode).text).toBe("message d'origine");
  });

  /**
   * R5 : l'édition repose les mentions, sous la forme que le serveur accepte — six champs, `count`
   * en NOMBRE. Le serveur remplace la liste entière : sans elles, corriger un message effaçait
   * ses mentions.
   */
  it("repose les mentions à l'édition, sous la forme complète que le serveur attend", async () => {
    const { result, rootInstance } = setup();
    const CAMILLE = "e".repeat(24);
    await act(async () => {
      result.current.edit.mutate({
        commentId: ROOT_ID, text: "merci @camille",
        mentions: [{ id: CAMILLE, name: "Camille", slug: "camille" }],
      });
    });
    await waitFor(() => expect(rootInstance.save).toHaveBeenCalled());
    expect(rootInstance.data.mentions).toEqual([
      { id: CAMILLE, name: "Camille", slug: "camille", type: "citoyens", value: "Camille", count: 1 },
    ]);
  });

  it("garde le type d'une mention héritée : une organisation n'est pas changée en citoyen", async () => {
    const { result, rootInstance } = setup();
    const FABRIQUE = "f".repeat(24);
    await act(async () => {
      result.current.edit.mutate({
        commentId: ROOT_ID, text: "voir @fabrique",
        mentions: [{ id: FABRIQUE, name: "La Fabrique", slug: "fabrique", type: "organizations" }],
      });
    });
    await waitFor(() => expect(rootInstance.save).toHaveBeenCalled());
    expect((rootInstance.data.mentions as Array<{ type: string }>)[0]!.type).toBe("organizations");
  });

  it("une édition sans mention envoie une liste VIDE, qui retire les anciennes", async () => {
    const { result, rootInstance } = setup();
    rootInstance.data.mentions = [{ id: "e".repeat(24), slug: "camille" }];
    await act(async () => {
      result.current.edit.mutate({ commentId: ROOT_ID, text: "plus de mention", mentions: [] });
    });
    await waitFor(() => expect(rootInstance.save).toHaveBeenCalled());
    expect(rootInstance.data.mentions).toEqual([]);
  });

  it("retire le message tout de suite, et le remet si la suppression échoue franchement", async () => {
    const onCountChange = vi.fn();
    const { result, nodesNow, initialNodes } = setup({
      onDelete: async () => { throw failure(404); },
      onCountChange,
    });

    result.current.remove.mutate({ commentId: ROOT_ID });

    await waitFor(() => expect(result.current.remove.isError).toBe(true));
    expect(nodesNow()).toStrictEqual(initialNodes);
    expect(onCountChange).not.toHaveBeenCalled();
  });

  it("décompte le message une fois la suppression confirmée", async () => {
    const onCountChange = vi.fn();
    const { result, nodesNow } = setup({ onCountChange });

    result.current.remove.mutate({ commentId: ROOT_ID });

    await waitFor(() => expect(result.current.remove.isSuccess).toBe(true));
    expect(nodesNow()).toHaveLength(0);
    expect(onCountChange).toHaveBeenCalledExactlyOnceWith(-1);
  });

  it("décompte UN message même quand il a des réponses : comme le serveur, qui n'efface pas en cascade", async () => {
    // `Comment::delete` n'efface que le message, et `Action::addAction` ne décompte qu'une unité :
    // les réponses deviennent orphelines — hors de l'affichage, mais toujours COMPTÉES. Annoncer la
    // branche entière faisait sauter le compteur de l'hôte au rechargement (revue du 29/09).
    const onCountChange = vi.fn();
    const { result, nodesNow } = setup({ onCountChange, withReplies: 2 });

    result.current.remove.mutate({ commentId: ROOT_ID });

    await waitFor(() => expect(result.current.remove.isSuccess).toBe(true));
    expect(nodesNow()).toHaveLength(0); // la branche quitte bien l'affichage
    expect(onCountChange).toHaveBeenCalledExactlyOnceWith(-1);
  });
});

describe("useCommentMutations — réaction", () => {
  it("bascule la pastille sans attendre le serveur", async () => {
    const { result, nodesNow } = setup({ onVote: () => new Promise(() => {}) });

    result.current.react.mutate({ commentId: ROOT_ID, reaction: "love" });

    await waitFor(() => expect((nodesNow()[0] as CommentNode).myReaction).toBe("love"));
    expect((nodesNow()[0] as CommentNode).reactions.love).toBe(1);
  });

  it("rend la pastille à son état initial si la réaction est refusée", async () => {
    const { result, nodesNow, initialNodes } = setup({ onVote: async () => { throw failure(401); } });

    result.current.react.mutate({ commentId: ROOT_ID, reaction: "love" });

    await waitFor(() => expect(result.current.react.isError).toBe(true));
    expect(nodesNow()).toStrictEqual(initialNodes);
    expect((nodesNow()[0] as CommentNode).myReaction).toBeNull();
  });

  it("périme la liste des votants une fois la réaction enregistrée", async () => {
    const { result, invalidateSpy } = setup();

    result.current.react.mutate({ commentId: ROOT_ID, reaction: "love" });

    await waitFor(() => expect(result.current.react.isSuccess).toBe(true));
    expect(invalidationsOn(invalidateSpy.mock.calls, "comment-voters")).toHaveLength(1);
  });
});

describe("useCommentMutations — signalement", () => {
  it("ne touche pas au fil", async () => {
    const { result, nodesNow, initialNodes, rootInstance } = setup();
    (rootInstance as unknown as { addReportAbuse: unknown }).addReportAbuse = vi.fn(async () => {});

    result.current.report.mutate({ commentId: ROOT_ID, reason: "spam" });

    await waitFor(() => expect(result.current.report.isSuccess).toBe(true));
    expect(nodesNow()).toStrictEqual(initialNodes);
    expect(toastSpies.success).toHaveBeenCalled();
  });
});

/**
 * Le rattachement des images.
 *
 * Le patron est celui de `news`, et il est **dénormalisé** : le message porte les identifiants
 * de ses documents, le backend les hydrate à la lecture. Ce qui est vérifié ici est le contrat
 * d'écriture — `mediaImg` doit atteindre le SDK, et seulement quand il y a quelque chose à
 * joindre : le schéma de `/co2/comment/save` est en `additionalProperties: false`, et un champ
 * vide n'y serait pas plus toléré qu'un champ inconnu.
 */
describe("useCommentMutations — images", () => {
  const DOC_A = "1".repeat(24);
  const DOC_B = "2".repeat(24);

  it("joint les documents au message posté", async () => {
    const { result, entity } = setup();

    await act(async () => {
      result.current.add.mutate({ text: "avec une capture", imageDocIds: [DOC_A, DOC_B] });
    });

    await waitFor(() => expect((entity as unknown as { comment: ReturnType<typeof vi.fn> }).comment)
      .toHaveBeenCalled());
    const payload = (entity as unknown as { comment: ReturnType<typeof vi.fn> }).comment.mock.calls[0][0];
    expect(payload.mediaImg).toEqual({ countImages: 2, images: [DOC_A, DOC_B] });
  });

  it("n'envoie AUCUN `mediaImg` quand il n'y a rien à joindre", async () => {
    const { result, entity } = setup();

    await act(async () => {
      result.current.add.mutate({ text: "message nu" });
    });

    await waitFor(() => expect((entity as unknown as { comment: ReturnType<typeof vi.fn> }).comment)
      .toHaveBeenCalled());
    const payload = (entity as unknown as { comment: ReturnType<typeof vi.fn> }).comment.mock.calls[0][0];
    expect("mediaImg" in payload).toBe(false);
  });

  // Sans cela, l'image disparaîtrait à l'instant de l'envoi pour ne revenir qu'à la relecture
  // du fil — un clignotement que l'affichage optimiste existe précisément pour éviter.
  it("montre les images dès l'affichage optimiste", async () => {
    const { result, nodesNow } = setup({ onSave: () => new Promise(() => {}) });

    act(() => {
      result.current.add.mutate({
        text: "",
        imageDocIds: [DOC_A],
        imagePreviews: [{ id: DOC_A, url: "blob:a", thumbUrl: "blob:a", name: "a.png" }],
      });
    });

    await waitFor(() => expect(nodesNow().some(n => n.pending)).toBe(true));
    const optimiste = nodesNow().find(n => n.pending)!;
    expect(optimiste.images).toEqual([
      { id: DOC_A, url: "blob:a", thumbUrl: "blob:a", name: "a.png" },
    ]);
  });

  /**
   * Contre-épreuve d'un défaut mesuré dans `Comment::update` : la branche `else` fait
   * `$unset mediaImg` dès que le champ manque à la requête. Corriger une faute de frappe
   * effacerait donc les images du message si l'édition ne les reposait pas.
   */
  it("repose les images à l'édition, sinon le backend les effacerait", async () => {
    const { result, rootInstance } = setup();

    await act(async () => {
      result.current.edit.mutate({
        commentId: ROOT_ID, text: "texte corrigé", imageDocIds: [DOC_A],
      });
    });

    await waitFor(() => expect(rootInstance.save).toHaveBeenCalled());
    expect((rootInstance.data as Record<string, unknown>).mediaImg)
      .toEqual({ countImages: 1, images: [DOC_A] });
  });
});
