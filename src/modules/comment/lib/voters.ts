import { toUnixSeconds } from "./commentTree";

/**
 * Normalisation de la réponse de `SHOW_VOTE`.
 *
 * Forme mesurée sur le backend réel :
 *   `vote: { "<userId>": { status, date, name, slug, profilThumbImageUrl, id, _id } }`
 *
 * Deux conséquences heureuses, vérifiées et non supposées :
 *   - l'entrée porte **déjà** le nom, le slug et l'avatar : afficher qui a réagi ne demande
 *     aucun appel supplémentaire, là où on aurait pu croire n'avoir que des identifiants ;
 *   - le serveur applique un **vote unique** — poser `like` sur un `love` remplace la réaction
 *     au lieu de la cumuler. C'est exactement ce que fait `toggleReaction` côté affichage, donc
 *     l'optimiste et la relecture concordent.
 */
export interface Voter {
  readonly id: string;
  readonly name: string;
  readonly slug: string | null;
  readonly avatarUrl: string | null;
  readonly reaction: string;
  /** Date du vote, en secondes UNIX. */
  readonly at: number;
}

export interface VotersData {
  readonly voters: readonly Voter[];
  /** Compteurs par réaction, tels que le serveur les tient. */
  readonly counts: Readonly<Record<string, number>>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

const str = (value: unknown): string => (typeof value === "string" ? value : "");

export function toVotersData(raw: unknown): VotersData {
  const root = asRecord(raw);
  const votes = asRecord(root.vote);

  const voters: Voter[] = [];
  for (const [userId, entry] of Object.entries(votes)) {
    const data = asRecord(entry);
    const reaction = str(data.status);
    // Une entrée sans statut n'est pas une réaction : l'ignorer vaut mieux qu'afficher un vide.
    if (!reaction) continue;
    voters.push({
      id: str(data.id) || userId,
      name: str(data.name),
      slug: str(data.slug) || null,
      avatarUrl: str(data.profilThumbImageUrl) || str(data.profilImageUrl) || null,
      reaction,
      at: toUnixSeconds(data.date),
    });
  }

  // Le plus récent d'abord : c'est l'ordre attendu d'une liste « qui a réagi ».
  voters.sort((a, b) => b.at - a.at);

  const counts: Record<string, number> = {};
  for (const [reaction, count] of Object.entries(asRecord(root.voteCount))) {
    const n = typeof count === "number" ? count : Number(count);
    if (Number.isFinite(n) && n > 0) counts[reaction] = n;
  }

  return { voters, counts };
}

/** Regroupe les votants par réaction, pour les onglets de la liste. */
export function groupVotersByReaction(
  voters: readonly Voter[],
): ReadonlyMap<string, readonly Voter[]> {
  const grouped = new Map<string, Voter[]>();
  for (const voter of voters) {
    const bucket = grouped.get(voter.reaction);
    if (bucket) bucket.push(voter);
    else grouped.set(voter.reaction, [voter]);
  }
  return grouped;
}

/**
 * Libellé compact « qui a réagi », pour une infobulle de pastille.
 * Rend les noms et, au-delà de `max`, le nombre de personnes restantes — jamais une liste
 * de trente noms sous le curseur.
 */
export function votersSummary(
  voters: readonly Voter[],
  max = 3,
): { readonly names: string; readonly others: number } {
  const named = voters.filter(v => v.name);
  return {
    names: named.slice(0, max).map(v => v.name).join(", "),
    others: Math.max(0, named.length - max),
  };
}
