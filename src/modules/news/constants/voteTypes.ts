import { Heart, ThumbsUp, Smile, Laugh, Angry, Frown, HandMetal } from "lucide-react";
import { Frown as Scared } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface VoteType {
  type: string;
  color: string;
  icon: LucideIcon;
  label?: string;
  bgHover?: string;
}

export const voteTypes: VoteType[] = [
  { type: "love", color: "red", icon: Heart, label: "reactionsTypes.love", bgHover: "hover:bg-red-50 dark:hover:bg-red-900/20" },
  { type: "like", color: "blue", icon: ThumbsUp, label: "reactionsTypes.like", bgHover: "hover:bg-blue-50 dark:hover:bg-blue-900/20" },
  { type: "enjoy", color: "green", icon: Smile, label: "reactionsTypes.enjoy", bgHover: "hover:bg-green-50 dark:hover:bg-green-900/20" },
  { type: "glad", color: "primary", icon: Laugh, label: "reactionsTypes.glad", bgHover: "hover:bg-primary/10 dark:hover:bg-primary/20" },
  { type: "bothered", color: "yellow", icon: Angry, label: "reactionsTypes.bothered", bgHover: "hover:bg-yellow-50 dark:hover:bg-yellow-900/20" },
  { type: "sad", color: "gray", icon: Frown, label: "reactionsTypes.sad", bgHover: "hover:bg-gray-50 dark:hover:bg-gray-700" },
  { type: "scared", color: "purple", icon: Scared, label: "reactionsTypes.scared", bgHover: "hover:bg-purple-50 dark:hover:bg-purple-900/20" },
  { type: "support", color: "indigo", icon: HandMetal, label: "reactionsTypes.support", bgHover: "hover:bg-indigo-50 dark:hover:bg-indigo-900/20" },
];