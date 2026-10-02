/**
 * Surface publique du module comment.
 *
 * Tout ce qu'un autre module consomme passe par ici — c'est ce qui permettra, au
 * rebranchement de `news` (J8), de ne toucher qu'à deux points d'appel hors de ce dossier.
 */

// L'enregistrement des ressources i18n est un effet de bord : il doit avoir lieu dès qu'on
// importe quoi que ce soit du module, sans quoi les libellés sortent en clés brutes.
import "./i18n";

export { CommentThread, type CommentThreadProps } from "./components/CommentThread";
export { CommentRow, type CommentRowProps, type MessageRow } from "./components/CommentRow";
export { CommentMarkdown, type CommentMarkdownProps } from "./components/CommentMarkdown";
export { CommentComposer, type CommentComposerProps } from "./components/CommentComposer";
export { CommentImages, type CommentImagesProps } from "./components/CommentImages";
export { ComposerImages, type ComposerImagesProps } from "./components/ComposerImages";
export { ReactionPills, type ReactionPillsProps } from "./components/ReactionPills";
export { ReactionPicker, type ReactionPickerProps } from "./components/ReactionPicker";
export { ReportCommentDialog } from "./components/ReportCommentDialog";
export { VotersDialog } from "./components/VotersDialog";
export { DateSeparator, UnreadSeparator } from "./components/ThreadSeparators";
export { DiscussionPanel, type DiscussionPanelProps } from "./components/panel/DiscussionPanel";
export { DiscussionModal, type DiscussionModalProps } from "./components/panel/DiscussionModal";
export { CarrierRail, type CarrierRailProps } from "./components/panel/CarrierRail";
export { ThreadColumn, type ThreadColumnProps } from "./components/panel/ThreadColumn";

export { useCommentsQuery, type CommentThreadData } from "./hooks/useCommentsQuery";
export { useCommentMutations, type CommentMutations } from "./hooks/useCommentMutations";
export { useCommentPermissions } from "./hooks/useCommentPermissions";
export { useCommentImages, type PendingImage } from "./hooks/useCommentImages";
export { useCommentVoters } from "./hooks/useCommentVoters";
export { useDiscussionsQuery, type DiscussionScope } from "./hooks/useDiscussionsQuery";
export { useCarrierEntity } from "./hooks/useCarrierEntity";
export { useDiscussionUrlState, type DiscussionUrlState } from "./hooks/useDiscussionUrlState";
export { useDiscussionLauncher, type DiscussionLauncher } from "./hooks/useDiscussionLauncher";
export { useDiscussionUnread } from "./hooks/useDiscussionUnread";

export { voteTypes, voteTypeMap, type VoteType } from "./constants/voteTypes";
export { COMMENT_QUERY_KEYS } from "./constants/queryKeys";
export { REPORT_REASONS, type ReportReason } from "./constants/reportReasons";

export { countNodes, countUnread, lastActivityAt, toCommentTree } from "./lib/commentTree";
export { flattenThread, type ThreadRow } from "./lib/flattenThread";
export { initialesDe } from "./lib/initiales";
export { linkifyMentions, toMentionPayload } from "./lib/linkifyMentions";
export {
  correspondAuxMots,
  filtrerFils,
  filtrerPorteurs,
  motsDeRequete,
  replierPourRecherche,
  segmenterCorrespondances,
} from "./lib/searchDiscussions";
export {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGES,
  imageFilesFrom,
  normalizeImages,
  screenImageFiles,
  toMediaImgPayload,
  type ImageRejection,
} from "./lib/commentImages";
export { groupVotersByReaction, toVotersData, votersSummary, type Voter } from "./lib/voters";
export {
  CARRIER_NONE,
  carrierKey,
  errorCodeOf,
  parseDiscussions,
  refusalOf,
  sortThreads,
  threadsOfCarrier,
  totalUnread,
} from "./lib/discussions";
export type { DiscussionErrorCode, RefusalCode } from "./lib/discussions";
export type { DiscussionSelection } from "./lib/filKey";
export {
  DEFAULT_DISCUSSION_PARAM,
  formatDiscussionValue,
  messageAnchorId,
  parseDiscussionValue,
  parseMessageFragment,
  threadValue,
} from "./lib/filKey";

export { CARRIER_TYPES, COMMENTABLE_TYPES, isCarrierType, isCommentableType } from "./types";
export type {
  CarrierRef, CarrierType, CommentableType, CommentAuthor, CommentImage, CommentMention, CommentNode,
  CommentTarget, DiscussionCarrier, DiscussionDepth, DiscussionThread, DiscussionsResult,
} from "./types";
export type { CommentPermissions } from "./permissions";
