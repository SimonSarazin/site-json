import { Loader2, AlertCircle, User, Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import {
  useCommonTableContributors,
  type CommonTableContributor,
} from "../hooks/useCommonTableContributors";
import type { HappinessValue } from "../types";
import { getNoteAppearance } from "../utils/commonTableNote";
import { cn } from "@/lib/utils";

interface CommonTableContributorsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formId: string | null | undefined;
  inputKey: string | null | undefined;
  /** Une ligne du tableau peut agréger plusieurs criteriaId (groupKey). */
  criteriaIds: string[];
  /** Libellé du besoin/usage — affiché dans le titre du dialog. */
  usageLabel: string;
}

const HAPPINESS_EMOJI: Record<Exclude<HappinessValue, "">, string> = {
  love: "😍",
  happySmile: "😀",
  neutral: "😐",
  sad: "😢",
  cry: "😭",
};

function getInitials(name: string): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function ContributorRow({
  c,
  noteLevels,
  happinessLabels,
}: {
  c: CommonTableContributor;
  noteLevels: string[];
  happinessLabels: Record<Exclude<HappinessValue, "">, string>;
}) {
  const noteAppearance = getNoteAppearance(c.note);
  const noteLabel = c.note > 0 ? (noteLevels[noteAppearance.idx] ?? "") : "";
  const happinessEmoji = c.happiness !== "" ? HAPPINESS_EMOJI[c.happiness] : null;
  const happinessLabel = c.happiness !== "" ? happinessLabels[c.happiness] : "";

  // Form collaboratif "par lieu" : on affiche le LIEU évalué au lieu de
  // l'évaluateur. Fallback sur l'évaluateur quand la réponse n'a pas de lieu.
  const place = c.place ?? null;
  const displayName = place ? place.name : c.userName;
  const displaySlug = place ? place.slug : c.userSlug;
  const displayImage = place ? place.image : "";
  const profileLink = displaySlug ? `/profil/${displaySlug}` : null;

  return (
    <tr className="border-b border-border last:border-0">
      {/* Colonne identité (avatar + nom + solution + commentaire) */}
      <td className="py-3 pr-3 align-top">
        <div className="flex items-start gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={displayImage || undefined} alt={displayName} className="object-cover" />
            <AvatarFallback className="bg-muted text-xs">
              {displayName ? (
                getInitials(displayName)
              ) : place ? (
                <Building2 className="h-4 w-4" />
              ) : (
                <User className="h-4 w-4" />
              )}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            {profileLink ? (
              <a
                href={profileLink}
                className="font-medium text-sm hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {displayName}
              </a>
            ) : (
              <span className="font-medium text-sm">{displayName}</span>
            )}
            <div className="text-sm text-muted-foreground mt-0.5 truncate">
              {c.criteria}
            </div>
            {c.comment && (
              <div className="text-xs text-muted-foreground mt-1 italic line-clamp-2">
                « {c.comment} »
              </div>
            )}
          </div>
        </div>
      </td>
      {/* Colonne satisfaction (emoji centré) */}
      <td className="py-3 px-2 align-top text-center">
        {happinessEmoji && (
          <span className="text-lg leading-none" title={happinessLabel} aria-label={happinessLabel}>
            {happinessEmoji}
          </span>
        )}
      </td>
      {/* Colonne note (label coloré, aligné à droite) */}
      <td className="py-3 pl-2 align-top text-right whitespace-nowrap">
        {noteLabel && (
          <span className={cn("text-xs font-medium", noteAppearance.textColor)}>
            {noteLabel}
          </span>
        )}
      </td>
    </tr>
  );
}

export function CommonTableContributorsDialog({
  open,
  onOpenChange,
  formId,
  inputKey,
  criteriaIds,
  usageLabel,
}: CommonTableContributorsDialogProps) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");

  const { contributors, isLoading, error } = useCommonTableContributors({
    formId,
    inputKey,
    criteriaIds,
    enabled: open,
  });

  // Form collaboratif "par lieu" → les contributions portent un `place` : on
  // adapte le sous-titre ("quels lieux" au lieu de "qui").
  const isPlaceMode = contributors.some((c) => !!c.place);

  // Mêmes labels que dans `UrgencyGauge` — résolus ici via i18n et passés
  // aux rows (pas de duplication des chaînes dans ce fichier).
  const noteLevels = [
    t("coform.commonTable.note.level.0"),
    t("coform.commonTable.note.level.1"),
    t("coform.commonTable.note.level.2"),
    t("coform.commonTable.note.level.3"),
    t("coform.commonTable.note.level.4"),
    t("coform.commonTable.note.level.5"),
  ];
  const happinessLabels: Record<Exclude<HappinessValue, "">, string> = {
    love: t("coform.commonTable.happiness.love"),
    happySmile: t("coform.commonTable.happiness.happySmile"),
    neutral: t("coform.commonTable.happiness.neutral"),
    sad: t("coform.commonTable.happiness.sad"),
    cry: t("coform.commonTable.happiness.cry"),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("coform.commonTable.contributors.title")}</DialogTitle>
          <DialogDescription>
            {t(
              isPlaceMode
                ? "coform.commonTable.contributors.descriptionPlace"
                : "coform.commonTable.contributors.description",
              undefined,
              { usage: usageLabel },
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {isLoading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">
                {t("coform.commonTable.contributors.loading")}
              </span>
            </div>
          )}

          {!isLoading && error && (
            <div className="flex items-start gap-2 p-4 rounded-md border border-destructive/30 bg-destructive/5 text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span className="text-sm">
                {t("coform.commonTable.contributors.error")}
              </span>
            </div>
          )}

          {!isLoading && !error && contributors.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">
              {t("coform.commonTable.contributors.empty")}
            </p>
          )}

          {!isLoading && !error && contributors.length > 0 && (
            <table className="w-full border-collapse text-sm">
              <colgroup>
                <col />
                <col className="w-12" />
                <col className="w-20" />
              </colgroup>
              <tbody>
                {contributors.map((c) => (
                  <ContributorRow
                    key={`${c.fromAnswerId}-${c.criteriaId}-${c.userId}`}
                    c={c}
                    noteLevels={noteLevels}
                    happinessLabels={happinessLabels}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
