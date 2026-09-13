/**
 * Agrégations du tab « Statistiques » (Vision Globale).
 *
 * Pures et testées, sur le même périmètre de réponses que les autres tabs
 * (`transformedResults` d'`AmpliSectionRenderer`).
 *
 * Nuance volontaire avec `getSummaryData` (helpers/summary.ts) : celui-ci
 * compte des RÉPONSES concernées (« idées amplifiées », « discussions
 * générées ») ; ici on compte les réactions et commentaires EUX-MÊMES
 * (« appréciations reçues »), ce que réclament les libellés du tableau de
 * bord. Les participants, eux, sont repris de `getSummaryData` : une seule
 * définition de l'identité d'un contributeur dans le module.
 */

import type { AmpliDataResponse } from "../types";
import { getSummaryData } from "../helpers/summary";

/** Décompte d'usage d'un tag — forme attendue par recharts (`name`/`value`). */
export interface AmpliTagCount {
  name: string;
  value: number;
}

/** Une réponse d'un classement (top likes / top commentaires). */
export interface AmpliTopAnswer {
  /** Identifiant serveur si exploitable, sinon chaîne vide (clé de rendu = index). */
  id: string;
  name: string;
  /** Nom de l'auteur, chaîne vide si la réponse est anonyme. */
  author: string;
  count: number;
}

export interface AmpliDashboardStats {
  /** Contributeurs uniques (même définition que le tab Réseau). */
  participants: number;
  /** Total des commentaires, toutes réponses confondues. */
  comments: number;
  /** Total des réactions reçues, toutes réponses confondues. */
  likes: number;
  /** Nombre de tags DISTINCTS utilisés. */
  tagsUsed: number;
  /** Décomptes par tag, triés décroissants. */
  tags: AmpliTagCount[];
  topLiked: AmpliTopAnswer[];
  topCommented: AmpliTopAnswer[];
}

/** Nombre d'entrées d'un dictionnaire serveur (`comments`, `vote`…). */
function entryCount(value: unknown): number {
  return value && typeof value === "object" ? Object.keys(value).length : 0;
}

/**
 * Réactions d'une réponse : `voteCount.like` fait foi quand le backend le
 * renvoie ; sinon on retombe sur les entrées de `vote` (un vote par
 * utilisateur), comme `MeeteemCard`.
 */
function likeCount(serverData: Record<string, unknown>): number {
  const voteCount = serverData.voteCount as { like?: unknown } | undefined;
  if (voteCount && typeof voteCount.like === "number") return voteCount.like;
  return entryCount(serverData.vote);
}

/** Tags d'une réponse — le champ extrait peut être absent, seul, ou multiple. */
function tagsOf(item: AmpliDataResponse): string[] {
  const raw = item.data?.tags;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/** Nom de l'auteur : forme enrichie (`includeUserInfo`) ou entité User brute. */
function authorOf(item: AmpliDataResponse): string {
  const enriched = item.user as { name?: unknown } | null | undefined;
  if (enriched && typeof enriched.name === "string") return enriched.name;
  const user = item.answer?.serverData?.user as { serverData?: { name?: unknown } } | undefined;
  return typeof user?.serverData?.name === "string" ? user.serverData.name : "";
}

/** Identifiant sérialisable d'une réponse (`_id` peut être un objet Mongo). */
function idOf(serverData: Record<string, unknown>): string {
  const raw = serverData._id ?? serverData.id;
  return typeof raw === "string" ? raw : "";
}

/** Classement décroissant, réponses à zéro exclues (rien à « classer »). */
function rank(entries: AmpliTopAnswer[], limit: number): AmpliTopAnswer[] {
  return entries
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Taille par défaut des classements affichés. */
export const AMPLI_TOP_ANSWERS_LIMIT = 5;

export function getDashboardStats(
  data: AmpliDataResponse[],
  limit: number = AMPLI_TOP_ANSWERS_LIMIT,
): AmpliDashboardStats {
  const items = data ?? [];
  const tagCounts = new Map<string, number>();
  const liked: AmpliTopAnswer[] = [];
  const commented: AmpliTopAnswer[] = [];
  let likes = 0;
  let comments = 0;

  items.forEach((item) => {
    const serverData = (item.answer?.serverData ?? {}) as Record<string, unknown>;
    const likeTotal = likeCount(serverData);
    const commentTotal = entryCount(serverData.comments);
    likes += likeTotal;
    comments += commentTotal;

    const base = {
      id: idOf(serverData),
      name: typeof item.data?.name === "string" ? item.data.name : "",
      author: authorOf(item),
    };
    liked.push({ ...base, count: likeTotal });
    commented.push({ ...base, count: commentTotal });

    tagsOf(item).forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    });
  });

  const tags = Array.from(tagCounts, ([name, value]) => ({ name, value })).sort(
    (a, b) => b.value - a.value,
  );

  return {
    participants: getSummaryData(items).totalUsers,
    comments,
    likes,
    tagsUsed: tags.length,
    tags,
    topLiked: rank(liked, limit),
    topCommented: rank(commented, limit),
  };
}
