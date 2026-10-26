import { ClipboardCheck, ClipboardList, ListTodo, Newspaper, Tag, type LucideIcon } from "lucide-react";
import { getEntityIconComponent } from "@/lib/entityIcons";
import type { CommentableType } from "../types";

/**
 * L'icône du type d'un fil, dans la liste hétérogène de la colonne 2.
 *
 * Elle n'est pas décorative : sur une colonne étroite, c'est elle SEULE qui distingue
 * « Une action » d'« Une actualité », le libellé cédant la place (voir `ThreadColumn`).
 *
 * Les cinq types d'entité déjà servis par la table partagée du site ne sont pas redéclarés
 * ici — une seconde source de vérité les ferait diverger au premier changement d'icône.
 * Seuls les cinq types commentables qu'elle ne couvre pas sont définis ci-dessous ; sans eux,
 * son repli rendrait une épingle de carte pour une actualité.
 */
const COMMENT_ONLY: Partial<Record<CommentableType, LucideIcon>> = {
  news: Newspaper,
  actions: ListTodo,
  forms: ClipboardList,
  answers: ClipboardCheck,
  classifieds: Tag,
};

export function contextIcon(type: CommentableType): LucideIcon {
  return COMMENT_ONLY[type] ?? getEntityIconComponent(type);
}
