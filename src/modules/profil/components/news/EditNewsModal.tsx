import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NewsFormTagsInput } from "./NewsFormTagsInput";
import { useT } from "@/hooks/useT";
import { useEditNews } from "../../hooks/useNewsMutations";
import type { News, EntityTypes } from "@communecter/cocolight-api-client";
import { toast } from "sonner";

interface EditNewsModalProps {
  entity: EntityTypes;
  news: News | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditNewsModal({ entity, news, open, onOpenChange }: EditNewsModalProps) {
  const t = useT("modules/profil");
  const editNewsMutation = useEditNews(entity, { optimistic: true });

  const [text, setText] = useState("");
  const [scope, setScope] = useState<"public" | "private" | "restricted">("public");
  const [tags, setTags] = useState<string[]>([]);

  const isEditingNews = editNewsMutation.isPending;

  // Pré-remplir les champs quand le modal s'ouvre
  useEffect(() => {
    if (open && news) {
      setText(news.data?.text || "");
      setScope((news.data?.scope as "public" | "private" | "restricted") || "public");
      setTags(news.data?.tags || []);
    }
  }, [open, news]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!news) return;

    if (!text.trim()) {
      toast.error(t("AddNewsModal.validation.textRequired"));
      return;
    }

    if (text.trim().length < 3) {
      toast.error(t("AddNewsModal.validation.textTooShort"));
      return;
    }

    editNewsMutation.mutate(
      {
        news,
        newText: text.trim(),
        newScope: scope,
        newTags: tags,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  if (!news) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">
            {t("NewsTab.edit")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-news-scope" className="text-sm sm:text-base font-semibold">
              {t("AddNewsModal.form.scope.label")}
            </Label>
            <Select
              value={scope}
              onValueChange={(value) => setScope(value as "public" | "private" | "restricted")}
              disabled={isEditingNews}
            >
              <SelectTrigger id="edit-news-scope" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">{t("AddNewsModal.form.scope.public")}</SelectItem>
                <SelectItem value="restricted">{t("AddNewsModal.form.scope.restricted")}</SelectItem>
                <SelectItem value="private">{t("AddNewsModal.form.scope.private")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Text area */}
          <div className="space-y-2">
            <Label htmlFor="edit-news-text" className="text-sm sm:text-base font-semibold">
              {t("AddNewsModal.form.text.label")} <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="edit-news-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("AddNewsModal.form.text.placeholder")}
              rows={6}
              className="resize-none text-sm sm:text-base"
              disabled={isEditingNews}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm sm:text-base font-semibold">
              {t("AddNewsModal.form.tags.label")}
            </Label>
            <NewsFormTagsInput
              tags={tags}
              onTagsChange={setTags}
              maxTags={10}
            />
          </div>

          <DialogFooter className="space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isEditingNews}
              className="text-xs sm:text-sm uppercase"
            >
              {t("AddNewsModal.actions.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isEditingNews || !text.trim()}
              className="bg-lime-700 hover:bg-lime-600 text-white font-semibold text-xs sm:text-sm uppercase"
            >
              {isEditingNews ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("AddNewsModal.actions.publishing")}
                </>
              ) : (
                t("NewsTab.edit")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
