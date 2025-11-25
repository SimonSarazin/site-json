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

// Export des contextes
export * from "./contexts";

// Export des schemas
export * from "./schema";

// Export des hooks (fonctions seulement, pas les types)
export { useNewsQuery } from "./hooks/useNewsQuery";
export { useFormatNews } from "./hooks/useFormatNews";
export { useFormatComment } from "./hooks/useFormatComment";
export { useNewsCommentsQuery } from "./hooks/useNewsCommentsQuery";
export { useNewsEntity } from "./hooks/useNewsEntity";
export * from "./hooks/useNewsMutations";
export * from "./hooks/useNewsVotes";
export * from "./hooks/useCommentMutations";

// Export des composants
export { NewsItem } from "./components/NewsItem";
export { AddNewsModal } from "./components/forms/AddNewsModal";
export { ImageCropDialog } from "./components/forms/ImageCropDialog";
export { NewsSection } from "./components/sections/NewsSection";
