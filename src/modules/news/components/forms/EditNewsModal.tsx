import { useState } from "react";
import { Loader2, Edit } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useT } from "@/hooks/useT";
import { useEditNews } from "../../hooks/useNewsMutations";
import type { News, EntityTypes } from "@communecter/cocolight-api-client";

interface EditNewsModalProps {
  entity: EntityTypes;
  news: News | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditNewsModal({ entity, news, open, onOpenChange }: EditNewsModalProps) {
  const t = useT("modules/news");
  const editNewsMutation = useEditNews(entity);

  const [text, setText] = useState(news?.serverData?.text || "");

  const isEditing = editNewsMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!news || !text.trim()) return;

    editNewsMutation.mutate(
      {
        news,
        newText: text.trim(),
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isEditing) {
      if (!newOpen) {
        setText(news?.serverData?.text || "");
      }
      onOpenChange(newOpen);
    }
  };

  if (!news) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5 text-blue-500" />
            {t("forms.editNews.title")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="news-text" className="text-sm font-semibold">
              {t("forms.editNews.textLabel")} <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="news-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("forms.editNews.textPlaceholder")}
              rows={6}
              className="resize-none text-sm"
              disabled={isEditing}
              required
            />
          </div>

          <DialogFooter className="space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isEditing}
            >
              {t("forms.editNews.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isEditing || !text.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isEditing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("forms.editNews.saving")}
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4 mr-2" />
                  {t("forms.editNews.save")}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}