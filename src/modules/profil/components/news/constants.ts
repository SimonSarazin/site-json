import { Heart, ThumbsUp, Smile, Laugh, Angry, Frown, HandMetal } from "lucide-react";
import { Frown as Scared } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { z } from "zod";

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
  { type: "glad", color: "teal", icon: Laugh, label: "reactionsTypes.glad", bgHover: "hover:bg-teal-50 dark:hover:bg-teal-900/20" },
  { type: "bothered", color: "yellow", icon: Angry, label: "reactionsTypes.bothered", bgHover: "hover:bg-yellow-50 dark:hover:bg-yellow-900/20" },
  { type: "sad", color: "gray", icon: Frown, label: "reactionsTypes.sad", bgHover: "hover:bg-gray-50 dark:hover:bg-gray-700" },
  { type: "scared", color: "purple", icon: Scared, label: "reactionsTypes.scared", bgHover: "hover:bg-purple-50 dark:hover:bg-purple-900/20" },
  { type: "support", color: "indigo", icon: HandMetal, label: "reactionsTypes.support", bgHover: "hover:bg-indigo-50 dark:hover:bg-indigo-900/20" },
];

export interface ReportReason {
  value: string;
  labelKey: string;
}

export const REPORT_REASONS: ReportReason[] = [
  { value: "spam", labelKey: "NewsTab.reportDialog.reasons.spam" },
  { value: "harassment", labelKey: "NewsTab.reportDialog.reasons.harassment" },
  { value: "hateSpeech", labelKey: "NewsTab.reportDialog.reasons.hateSpeech" },
  { value: "violence", labelKey: "NewsTab.reportDialog.reasons.violence" },
  { value: "inappropriate", labelKey: "NewsTab.reportDialog.reasons.inappropriate" },
  { value: "misinformation", labelKey: "NewsTab.reportDialog.reasons.misinformation" },
  { value: "other", labelKey: "NewsTab.reportDialog.reasons.other" },
];

export const TYPE_ORGA_OPTIONS = [
  { value: "NGO", label: "Association" },
  { value: "LocalBusiness", label: "Entreprise locale" },
  { value: "Group", label: "Groupe" },
  { value: "GovernmentOrganization", label: "Organisation gouvernementale" },
  { value: "Cooperative", label: "Coopérative" },
];

export const AVANCEMENT_OPTIONS = [
  { value: "idea", label: "Idée" },
  { value: "starting", label: "Démarrage" },
  { value: "development", label: "Développement" },
  { value: "mature", label: "Mature" },
  { value: "ending", label: "Fin" },
];

export const infoSchema = z.object({
  name: z.string().min(2, "Le nom doit avoir au moins 2 caractères"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  url: z.string().url("URL invalide").optional().or(z.literal("")),
  fixe: z.string().optional(),
  mobile: z.string().optional(),
  birthDate: z.string().optional(),
  type: z.string().optional(),
  avancement: z.string().optional(),
  tags: z.string().optional(),
});
