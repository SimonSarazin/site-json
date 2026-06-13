import { memo } from "react";
import { History, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";
import { formatRelative } from "../utils/formatRelative";

type DraftRecoveryBannerProps =
  | {
      mode: "restorable";
      timestamp: number;
      onRestore: () => void;
      onDiscard: () => void;
    }
  | {
      mode: "stale";
      timestamp: number;
      onAcknowledge: () => void;
    };

function DraftRecoveryBannerImpl(props: DraftRecoveryBannerProps) {
  const t = useT("modules/coform");
  const relative = formatRelative(props.timestamp, t);

  if (props.mode === "stale") {
    return (
      <Alert className="mb-4">
        <Info className="h-4 w-4" />
        <AlertTitle>{t("coform.draft.stale.title")}</AlertTitle>
        <AlertDescription className="gap-2">
          <p>{t("coform.draft.stale.description")}</p>
          <div className="flex justify-end">
            <Button type="button" size="sm" variant="outline" onClick={props.onAcknowledge}>
              {t("coform.draft.stale.ok")}
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="mb-4">
      <History className="h-4 w-4" />
      <AlertTitle>{t("coform.draft.restorable.title")}</AlertTitle>
      <AlertDescription className="gap-2">
        <p>{t("coform.draft.restorable.description", undefined, { relative })}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" size="sm" variant="outline" onClick={props.onDiscard}>
            {t("coform.draft.restorable.discard")}
          </Button>
          <Button type="button" size="sm" onClick={props.onRestore}>
            {t("coform.draft.restorable.restore")}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

export const DraftRecoveryBanner = memo(DraftRecoveryBannerImpl);
