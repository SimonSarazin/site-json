import { useMemo } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import {
  OPENER_ATTRIBUTE,
  preloadSpaceModal,
  questionDiscussion,
  useDiscussionSpaceQuery,
  useSpaceLauncher,
  type SpaceRef,
} from "@/modules/comment/launch";
import { useFormStepKey } from "../contexts/FormStepKeyContext";
import { getOriginalFieldKey } from "../utils/formParser";
import type { FormFieldMapping } from "../types";

/** Ce qu'un libellé de question sait de sa question — ce qu'il reçoit déjà, plus le drapeau. */
export type DiscussedQuestion = Pick<FormFieldMapping, "label" | "name" | "componentType" | "activeComments">;

/** Un nom de question trop long pour une infobulle est coupé : le libellé, lui, est juste à côté. */
const NOM_MAX = 80;

/**
 * Le nom par lequel le bouton d'une question se désigne, pour que le focus lui revienne quand la
 * modale se ferme — par son étape et sa clé : deux étapes peuvent avoir une question de même clé.
 */
function questionOpener(step: string | null, question: string): string {
  return `question:${step ?? ""}:${question}`;
}

/**
 * Le bouton de discussion d'une QUESTION, à côté de son libellé : il ouvre l'espace de discussion de
 * la réponse, sur le fil de cette question.
 *
 * Parité legacy : le bouton aux bulles et sa pastille du nombre de messages, sur chaque question
 * ouverte aux commentaires (`activeComments`, `step.php`, `step_v2.php`) — au formulaire d'un commun
 * comme à un formulaire général.
 *
 * Le libellé ne le pose que pour une question ouverte aux commentaires, sous un hôte
 * (`FormQuestionDiscussions`, qui monte la modale et dit la réponse) : `FieldLabel` en écriture,
 * `ReadOnlyLabel` en lecture. Il ne rend rien quand l'espace ne propose aucun fil pour elle — ou rien
 * à y lire pour qui ne peut pas écrire. La liste du serveur fait autorité : le drapeau ne dit qu'où
 * chercher.
 */
export function QuestionDiscussionButton({ answerId, field, className }: { answerId: string; field: DiscussedQuestion; className?: string }) {
  const t = useT("modules/coform");
  const step = useFormStepKey();
  const question = getOriginalFieldKey(field);
  const space = useMemo<SpaceRef>(() => ({ type: "answers", id: answerId }), [answerId]);
  const launcher = useSpaceLauncher(space);
  // La même entrée de cache pour toutes les questions de la réponse : un bouton par question ne
  // coûte aucune requête de plus.
  const { threads, canComment } = useDiscussionSpaceQuery(space);
  const { target, total, unread } = questionDiscussion(threads, step, question);

  if (target === null || (total === 0 && !canComment)) return null;

  const nom = field.label.trim();
  const nomCourt = nom.length > NOM_MAX ? `${nom.slice(0, NOM_MAX - 1).trimEnd()}…` : nom;
  // Le nom accessible dit ce qu'on ouvre, puis ce qu'il y a à lire.
  const libelle = [
    String(nomCourt ? t("coform.field.discussion.questionNamed", undefined, { label: nomCourt }) : t("coform.field.discussion.question")),
    total > 0 ? String(t("coform.field.discussion.messages", undefined, { count: total })) : null,
    unread > 0 ? String(t("coform.field.discussion.unread", undefined, { count: unread })) : null,
  ].filter(Boolean).join(", ");
  const ouvreur = questionOpener(step, question);

  return (
    <Button
      // `type="button"`, explicitement : dans un formulaire, un bouton sans type le soumet.
      type="button"
      variant="ghost"
      size="sm"
      className={cn("text-muted-foreground hover:text-foreground h-7 shrink-0 gap-1 has-[>svg]:px-1.5", className)}
      // Ce que le bouton ouvre est un dialogue : le lecteur d'écran l'annonce avant le clic.
      aria-haspopup="dialog"
      aria-label={libelle}
      title={libelle}
      onClick={() => launcher.openAt(target, ouvreur)}
      // Le code de la modale arrive avant le clic.
      onMouseEnter={preloadSpaceModal}
      onFocus={preloadSpaceModal}
      data-question-discussion={question}
      {...{ [OPENER_ATTRIBUTE]: ouvreur }}
    >
      <MessageSquare className="size-4" aria-hidden />
      {total > 0 && <span className="tabular-nums text-xs" data-question-discussion-total>{total}</span>}
      {unread > 0 && (
        <span
          className="bg-primary text-primary-foreground min-w-5 rounded-full px-1.5 py-0.5 text-center text-[0.6875rem] leading-none font-semibold tabular-nums"
          data-question-discussion-unread
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Button>
  );
}
