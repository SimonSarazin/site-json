export interface ReportReason {
  value: string;
  labelKey: string;
}

export const REPORT_REASONS: ReportReason[] = [
  { value: "spam", labelKey: "reportDialog.reasons.spam" },
  { value: "harassment", labelKey: "reportDialog.reasons.harassment" },
  { value: "hateSpeech", labelKey: "reportDialog.reasons.hateSpeech" },
  { value: "violence", labelKey: "reportDialog.reasons.violence" },
  { value: "inappropriate", labelKey: "reportDialog.reasons.inappropriate" },
  { value: "misinformation", labelKey: "reportDialog.reasons.misinformation" },
  { value: "other", labelKey: "reportDialog.reasons.other" },
];
