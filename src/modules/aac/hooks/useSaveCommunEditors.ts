/**
 * Mutation : enregistrer les contributeurs à l'édition d'un commun.
 *
 * Deux écritures par `updateField` — le `path2Value` du legacy, sous la même garde backend
 * (`Element::updatePathValue` : auteur, admins) : `links.canEdit`, puis la question que le
 * formulaire déclare par `addToLinks` s'il y en a une. Chacune n'est faite que si elle change
 * quelque chose (`editorsWrites`).
 *
 * La réponse est RELUE avant d'écrire : elle fournit le contenu des entrées conservées et décide de
 * ce qui doit s'écrire (`editorsWrites`). La liste des personnes, elle, est celle de l'écran : le
 * dernier qui enregistre l'emporte, comme dans le legacy (`campDetail.php`).
 */
import type { Api } from "@communecter/cocolight-api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { useT } from "@/hooks/useT";
import { COFORM_QUERY_KEYS } from "@/modules/coform/constants/queryKeys";
import {
  EDITORS_LINK,
  editorsWrites,
  toEditorsLinkValue,
  toEditorsQuestionValue,
  type CommunEditors,
  type EditorsQuestion,
} from "../lib/communEditors";
import { COMMUN_ANSWER_PREFIX } from "../prefetch/prefetchCommun";

export function useSaveCommunEditors(opts: {
  api: Api | null;
  answerId: string | null;
  question: EditorsQuestion | null;
  /** Formulaire de l'appel : la clé de la réponse côté coform l'exige. */
  formId?: string | null;
}) {
  const t = useT("modules/aac");
  const queryClient = useQueryClient();

  // Rend le formulaire de DÉPÔT de la réponse, lu à la relecture (cf. l'invalidation plus bas).
  return useMutationWithToast<string | null, { editors: CommunEditors }>({
    mutationFn: async ({ editors }) => {
      if (!opts.api || !opts.answerId) {
        throw new Error(String(t("detail.editors.toasts.incompleteContext")));
      }
      const answer = await opts.api.answer({ id: opts.answerId });
      const serveur = answer.serverData;
      const ecrire = editorsWrites(editors, serveur, opts.question);
      if (ecrire.link) {
        await answer.updateField(`links.${EDITORS_LINK}`, toEditorsLinkValue(editors, serveur));
      }
      if (ecrire.question && opts.question) {
        await answer.updateField(
          opts.question.path,
          toEditorsQuestionValue(editors, serveur, opts.question)
        );
      }
      const formDeDepot = (serveur as { form?: unknown }).form;
      return typeof formDeDepot === "string" && formDeDepot ? formDeDepot : null;
    },
    successKey: "detail.editors.toasts.saveSuccess",
    errorKey: "detail.editors.toasts.saveError",
    invalidateQueries: opts.answerId ? [COMMUN_ANSWER_PREFIX(opts.answerId)] : [],
    // La même réponse lue par le coform — page de réponse (`CoFormAnswerPage`), aperçu de recherche
    // (`PreviewCoformAnswer`) —, rangée sous le formulaire de sa route ou de sa référence : celui de
    // l'appel ET celui de dépôt, qui diffèrent pour un commun déposé sur un autre appel. Sans quoi
    // elle y reparaîtrait sans les personnes qu'on vient d'écrire. (La modale « Modifier » de la
    // fiche, elle, part de la réponse de la fiche, invalidée ci-dessus.)
    onSuccessCallback: (formDeDepot) => {
      const answerId = opts.answerId;
      if (!answerId) return;
      const formulaires = [opts.formId, formDeDepot].filter(
        (id, i, tous): id is string => typeof id === "string" && id !== "" && tous.indexOf(id) === i
      );
      for (const formId of formulaires) {
        void queryClient.invalidateQueries({ queryKey: COFORM_QUERY_KEYS.FORM_ANSWER_PREFIX(formId, answerId) });
      }
    },
    namespace: "modules/aac",
  });
}
