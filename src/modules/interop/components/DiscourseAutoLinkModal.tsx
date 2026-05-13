import { MessageSquare, Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/hooks/useT";
import { useInteropConfig } from "../hooks/useInteropConfigQuery";
import { useDiscourseLink, useDiscourseDismiss } from "../hooks/useInteropMutation";
import "../i18n";

interface DiscourseAutoLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autoUser: Record<string, unknown> | null;
}

export default function DiscourseAutoLinkModal({
  open,
  onOpenChange,
  autoUser,
}: DiscourseAutoLinkModalProps) {
  const t = useT("modules/interop");
  const { discourseUrl } = useInteropConfig();
  const linkMutation = useDiscourseLink();
  const dismissMutation = useDiscourseDismiss();

  const handleConfirmAutoLink = () => {
    const username = (autoUser?.username as string) ?? "";
    if (username) {
      linkMutation.mutate(username, { onSuccess: () => onOpenChange(false) });
    }
  };

  const handleDismiss = () => {
    dismissMutation.mutate(undefined, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 uppercase tracking-wide text-sm font-bold">
            <MessageSquare className="h-4 w-4 text-primary" />
            {t("discourse.account_found_title")}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {t("discourse.account_found_description")}
        </p>

        {autoUser && (
          <div className="flex items-center gap-3 rounded-lg border border-border p-3 bg-muted/40">
            {typeof autoUser.avatar_template === "string" && (
              <img
                src={`${discourseUrl}${autoUser.avatar_template.replace("{size}", "120")}`}
                alt=""
                className="h-10 w-10 rounded-full"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">
                {String(autoUser.name ?? autoUser.username)}
              </p>
              <p className="text-xs text-muted-foreground">
                @{String(autoUser.username)}
              </p>
              {discourseUrl && (
                <a
                  href={`${discourseUrl}/u/${String(autoUser.username)}/summary`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  {t("discourse.see_forum_profile")}
                </a>
              )}
            </div>
          </div>
        )}

        <p className="text-sm">{t("discourse.account_found_question")}</p>

        <div className="flex justify-end gap-2 mt-2">
          <Button
            variant="outline"
            onClick={handleDismiss}
            disabled={dismissMutation.isPending}
          >
            <X className="h-4 w-4 mr-1" />
            {t("discourse.decline_link")}
          </Button>
          <Button
            onClick={handleConfirmAutoLink}
            disabled={linkMutation.isPending}
          >
            <Link2 className="h-4 w-4 mr-1" />
            {t("discourse.confirm_link")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
