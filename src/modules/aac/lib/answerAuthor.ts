import type { CoFormAnswer } from "@/modules/coform/types";

/**
 * Qui a DÉPOSÉ cette réponse.
 *
 * ⚠️ Ne jamais lire `answer.user` pour ça. `FindAnsweredByIdAction` pose d'abord
 * `userId` (l'id brut du déposant), puis **écrase** `user` par une entité
 * résolue destinée à l'affichage, en prenant dans l'ordre :
 * `links.organizations` → `links.answered[0]` → le finder de `finderPath`.
 *
 * Sur un commun porté par une organisation — le cas courant d'un AAC — `user`
 * contient donc l'ORGANISATION. Comparer son `_id` à l'utilisateur courant
 * échoue alors toujours, et le déposant perd son bouton « Modifier » : seul un
 * admin le voyait.
 *
 * Le repli sur `user` reste utile pour les réponses d'autres sources, où le
 * champ n'a pas été remanié et porte encore l'id.
 */
export function resolveAnswerAuthorId(
  answer: Pick<CoFormAnswer, "userId" | "user"> | null | undefined
): string | undefined {
  if (!answer) return undefined;
  if (typeof answer.userId === "string" && answer.userId.trim() !== "") {
    return answer.userId;
  }
  if (typeof answer.user === "string") return answer.user || undefined;
  return answer.user?._id || undefined;
}
