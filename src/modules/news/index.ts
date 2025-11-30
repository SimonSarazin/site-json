/**
 * Module News
 *
 * Module indépendant pour la gestion des actualités, commentaires et réactions.
 * Extrait du module profil pour améliorer la modularité et la réutilisabilité.
 */

// Export des types
export * from "./types";

// Export des utilitaires
export * from "./utils";

// Export des constantes
export * from "./constants";

// Export des contextes
export * from "./contexts";

// Export des schemas
export * from "./schema";

// Export des prefetch
export * from "./prefetch";

// Export des hooks
export { useNewsQuery } from "./hooks/useNewsQuery";
export { useNewsByIdQuery } from "./hooks/useNewsByIdQuery";
export { useFormatNews } from "./hooks/useFormatNews";
export { useFormatComment } from "./hooks/useFormatComment";
export { useNewsCommentsQuery } from "./hooks/useNewsCommentsQuery";
export { useNewsEntity } from "./hooks/useNewsEntity";
export { useNewsContext, useOptionalNewsContext } from "./hooks/useNewsContext";
export * from "./hooks/useNewsMutations";
export * from "./hooks/useNewsVotes";
export * from "./hooks/useCommentMutations";

// Export des composants
export * from "./components";
