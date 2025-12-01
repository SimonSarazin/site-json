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
import { useShareNews } from "../../hooks/useNewsMutations";
import type { News, EntityTypes } from "@communecter/cocolight-api-client";

interface ShareNewsDialogProps {
  entity: EntityTypes;
  news: News | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareNewsDialog({ entity, news, open, onOpenChange }: ShareNewsDialogProps) {
  const t = useT("modules/profil");
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
            <Share2 className="w-5 h-5" />
            {t("NewsTab.share")}
          </DialogTitle>
          <DialogDescription>
            Ajoutez un commentaire à votre partage (optionnel)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="share-text" className="text-sm font-semibold">
              Votre commentaire
            </Label>
            <Textarea
              id="share-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ajoutez un commentaire sur ce partage..."
              rows={4}
              className="resize-none text-sm"
              disabled={isSharingNews}
            />
          </div>

          {/* Preview de la news originale */}
          <div className="bg-muted/50 rounded-lg p-4 border border-border">
            <p className="text-sm text-muted-foreground mb-2">Actualité partagée :</p>
            <p className="text-sm line-clamp-3">
              {news.data?.text || ""}
            </p>
          </div>
        </div>

        <DialogFooter className="space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSharingNews}
            className="text-xs sm:text-sm uppercase"
          >
            {t("AddNewsModal.actions.cancel")}
          </Button>
          <Button
            onClick={handleShare}
            disabled={isSharingNews}
            className="bg-lime-700 hover:bg-lime-600 text-white font-semibold text-xs sm:text-sm uppercase"
          >
            {isSharingNews ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Partage...
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 mr-2" />
                Partager
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
