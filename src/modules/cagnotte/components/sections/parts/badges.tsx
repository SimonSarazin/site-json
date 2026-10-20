/**
 * Badges et avatars d'affichage pour `ActionsSection` et ses parts.
 * Composants purement présentationnels, sans état ni effet de bord.
 */
import type { ReactNode } from "react";
import { CheckCircle2, CircleDot } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { initials } from "@/modules/cagnotte/utils/format";
import type {
  FundingActionStatus as ActionStatus,
  FundingContributor as Contributor,
  FundingMilestoneStatus as MilestoneUiStatus,
} from "@/modules/cagnotte/types";

/**
 * Signature locale de la fonction `t` retournée par `useT`. Acceptée par les badges
 * pour éviter d'imposer un import circulaire de `@/types/locale-schema`.
 */
export type TFunc = (
  key: string,
  fallback?: string,
  interpolationParams?: Record<string, unknown>,
) => string | import("@/types/locale-schema").LocalizedString;

export function MilestoneStatusBadge({
  status,
  t,
}: {
  status: MilestoneUiStatus;
  t: TFunc;
}) {
  const config: Record<MilestoneUiStatus, { label: string; className: string }> = {
    open: {
      label: String(t("ActionsSection.statusBadges.milestoneOpen")),
      className: "bg-primary/15 text-primary",
    },
    done: {
      label: String(t("ActionsSection.statusBadges.milestoneDone")),
      className: "bg-success/20 text-success",
    },
    close: {
      label: String(t("ActionsSection.statusBadges.milestoneClose")),
      className: "bg-muted text-muted-foreground",
    },
  };
  const current = config[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${current.className}`}
    >
      {current.label}
    </span>
  );
}

export function ActionStatusBadge({ status, t }: { status: ActionStatus; t: TFunc }) {
  const config: Record<ActionStatus, { icon: ReactNode; label: string; className: string }> = {
    todo: {
      icon: <CircleDot className="h-3 w-3" />,
      label: String(t("ActionsSection.statusBadges.actionTodo")),
      className: "bg-primary/10 text-primary",
    },
    done: {
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: String(t("ActionsSection.statusBadges.actionDone")),
      className: "bg-success/20 text-success",
    },
  };
  const current = config[status] ?? config.todo;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${current.className}`}
    >
      {current.icon}
      {current.label}
    </span>
  );
}

export function ContributorsAvatars({
  contributors,
  t,
  showLabel = true,
}: {
  contributors: Contributor[];
  t: TFunc;
  showLabel?: boolean;
}) {
  if (contributors.length === 0) return null;
  const visible = contributors.slice(0, 3);
  const overflow = contributors.slice(3);

  return (
    <div className="flex items-center gap-1.5">
      {showLabel && (
        <span className="text-xs text-muted-foreground">
          {String(t("ActionsSection.contributorsLabel"))}
        </span>
      )}
      <div className="flex -space-x-1">
        {visible.map((contributor) => (
          <Tooltip key={contributor.id}>
            <TooltipTrigger asChild>
              <Avatar className="h-6 w-6 border-2 border-background">
                <AvatarFallback className="text-[9px] bg-primary/20 text-primary-foreground">
                  {contributor.name && contributor.name !== "" ? initials(contributor.name) : ""}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>{contributor.name}</TooltipContent>
          </Tooltip>
        ))}
        {overflow.length > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[9px] font-semibold text-muted-foreground">
                +{overflow.length}
              </div>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>
              {contributors.map((contributor) => contributor.name).join(", ")}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
