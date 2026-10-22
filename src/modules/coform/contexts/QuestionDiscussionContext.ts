import { createContext } from "react";

/**
 * La réponse dont le formulaire montre les questions, quand leurs discussions s'y ouvrent
 * (`FormQuestionDiscussions`). `null` : aucun bouton — un dépôt pas encore enregistré n'a pas de
 * discussion, et un formulaire sans question ouverte, ou hors d'un site complet, n'en propose pas.
 */
export const QuestionDiscussionContext = createContext<string | null>(null);
