import { useMemo, type ReactNode } from "react";
import { useInRouterContext } from "react-router";
import { useCocolightOptional } from "@/hooks/useCocolight";
import { SpaceModalHost, type SpaceRef } from "@/modules/comment/launch";
import { QuestionDiscussionContext } from "../contexts/QuestionDiscussionContext";
import type { CoFormData, SubFormFields } from "../types";

export interface FormQuestionDiscussionsProps {
  /** La réponse que le formulaire montre — absente tant qu'elle n'est pas enregistrée. */
  answerId?: string | null;
  /** Le formulaire : son nom titre la modale, son type dit si l'espace est celui d'un commun. */
  form?: Pick<CoFormData, "name" | "type"> | null;
  /** Ses étapes parsées : rien ne s'ouvre si aucune de leurs questions n'est ouverte aux commentaires. */
  steps: readonly SubFormFields[];
  children: ReactNode;
}

/**
 * Ouvre les discussions des questions d'un formulaire : le bouton que chaque question ouverte aux
 * commentaires pose à côté de son libellé (`QuestionDiscussionButton`), et la modale de l'espace de
 * la réponse, qu'ils ouvrent par l'adresse.
 *
 * Le formulaire va chercher le module comment, à l'inverse de l'emplacement des lignes de dépense
 * (`MilestoneLineSlotContext`, qu'un hôte aac remplit) : la discussion d'une question appartient au
 * formulaire lui-même, sur toutes ses surfaces — quatorze, dont les pages propres à coform —, pas à
 * une page qui saurait quoi y poser. Il n'en prend que l'entrée légère ; le code de la modale arrive
 * à l'ouverture.
 *
 * Rien ne s'ouvre sans réponse enregistrée (un dépôt neuf n'a pas encore de discussion — le legacy
 * n'y montre pas non plus le bouton), sans question ouverte, ni hors d'un site complet : `SmartCoForm`
 * sait vivre sans session Cocolight ni routeur, le bouton non. La modale est celle de la page quand la
 * page en monte une pour le même espace — la fiche d'un commun, sous son formulaire d'édition : cet
 * hôte, de rang « formulaire », s'efface alors devant elle (`SpaceModalHost`).
 *
 * L'arbre ne change jamais de forme : le fournisseur est toujours là, la modale À CÔTÉ des enfants.
 * Une réponse qui reçoit son identifiant pendant la saisie ne fait donc pas remonter le formulaire.
 */
export function FormQuestionDiscussions({ answerId, form, steps, children }: FormQuestionDiscussionsProps) {
  const site = useCocolightOptional();
  const routeur = useInRouterContext();
  const ouvertes = useMemo(() => steps.some(step => step.fields.some(field => field.activeComments)), [steps]);
  const id = answerId && ouvertes && site && routeur ? answerId : null;
  const space = useMemo<SpaceRef | null>(() => (id ? { type: "answers", id } : null), [id]);
  return (
    <QuestionDiscussionContext.Provider value={id}>
      {children}
      {space && (
        <SpaceModalHost
          space={space}
          title={form?.name ?? null}
          // Un commun ⇔ un appel `aap` : la règle même de l'espace (`Discussion::spaceCreatableAudiences`).
          subject={form?.type === "aap" ? "commun" : "answer"}
          rank="form"
        />
      )}
    </QuestionDiscussionContext.Provider>
  );
}
