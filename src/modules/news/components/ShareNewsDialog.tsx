import { useState } from "react";
import { Loader2, Share2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useT } from "@/hooks/useT";
import { useShareNews } from "../hooks/useNewsMutations";
import type { News, EntityTypes } from "@communecter/cocolight-api-client";

interface ShareNewsDialogProps {
  entity: EntityTypes;
  news: News | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareNewsDialog({ entity, news, open, onOpenChange }: ShareNewsDialogProps) {
  const t = useT("modules/news");
  const shareNewsMutation = useShareNews(entity);

  const [text, setText] = useState("");

  const isSharingNews = shareNewsMutation.isPending;

  const handleShare = () => {
    if (!news) return;

    shareNewsMutation.mutate(
      {
        originalNews: news,
        text: text.trim(),
      },
      {
        onSuccess: () => {
          setText("");
          onOpenChange(false);
        },
      }
    );
  };

  if (!news) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-500" />
            {t("shareDialog.title")}
          </DialogTitle>
          <DialogDescription>
            {t("shareDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="share-text" className="text-sm font-semibold">
              {t("shareDialog.messageLabel")}
            </Label>
            <Textarea
              id="share-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("shareDialog.messagePlaceholder")}
              rows={3}
              className="resize-none text-sm"
              disabled={isSharingNews}
            />
          </div>
        </div>

        <DialogFooter className="space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSharingNews}
          >
            {t("shareDialog.cancel")}
          </Button>
          <Button
            onClick={handleShare}
            disabled={isSharingNews}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSharingNews ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t("shareDialog.sharing")}
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 mr-2" />
                {t("shareDialog.share")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}