import { useState } from "react";
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
import { NewsFormImageUpload } from "./NewsFormImageUpload";
import { NewsFormDocumentUpload } from "./NewsFormDocumentUpload";
import { NewsFormTagsInput } from "./NewsFormTagsInput";
import { useT } from "@/hooks/useT";
import { useAddNews } from "../../hooks/useNewsMutations";
import { EntityTypes } from "@communecter/cocolight-api-client";
import { toast } from "sonner";

interface AddNewsModalProps {
  entity: EntityTypes,
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddNewsModal({ entity, open, onOpenChange }: AddNewsModalProps) {
  const t = useT("modules/profil");
  const addNewsMutation = useAddNews(entity);

  const [text, setText] = useState("");
  const [scope, setScope] = useState<"public" | "private" | "restricted">("public");
  const [tags, setTags] = useState<string[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);

  const isAddingNews = addNewsMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!text.trim()) {
      toast.error(t("AddNewsModal.validation.textRequired"));
      return;
    }

    if (text.trim().length < 3) {
      toast.error(t("AddNewsModal.validation.textTooShort"));
      return;
    }

    addNewsMutation.mutate({
        newsData:{
          text: text.trim(),
          tags,
          scope,
        },
        images,
        documents,
      },      
      {
        onSuccess: () => {
          setText("");
          setScope("public");
          setTags([]);
          setImages([]);
          setDocuments([]);
          onOpenChange(false);
        },
      });

  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">
            {t("AddNewsModal.title")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="news-scope" className="text-sm sm:text-base font-semibold">
              {t("AddNewsModal.form.scope.label")}
            </Label>
            <select
              id="news-scope"
              value={scope}
              onChange={(e) => setScope(e.target.value as "public" | "private" | "restricted")}
              disabled={isAddingNews}
              className="block w-full p-2.5 text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="public">{t("AddNewsModal.form.scope.public")}</option>
              <option value="restricted">{t("AddNewsModal.form.scope.restricted")}</option>
              <option value="private">{t("AddNewsModal.form.scope.private")}</option>
            </select>
          </div>

          {/* Text area */}
          <div className="space-y-2">
            <Label htmlFor="news-text" className="text-sm sm:text-base font-semibold">
              {t("AddNewsModal.form.text.label")} <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="news-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("AddNewsModal.form.text.placeholder")}
              rows={6}
              className="resize-none text-sm sm:text-base"
              disabled={isAddingNews}
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

          <div className="space-y-2">
            <Label className="text-sm sm:text-base font-semibold">
              {t("AddNewsModal.form.images.label")}
            </Label>
            <NewsFormImageUpload
              images={images}
              onImagesChange={setImages}
              maxImages={10}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm sm:text-base font-semibold">
              {t("AddNewsModal.form.documents.label")}
            </Label>
            <NewsFormDocumentUpload
              documents={documents}
              onDocumentsChange={setDocuments}
              maxDocuments={5}
            />
          </div>

          <DialogFooter className="space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isAddingNews}
              className="text-xs sm:text-sm uppercase"
            >
              {t("AddNewsModal.actions.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isAddingNews || !text.trim()}
              className="bg-lime-700 hover:bg-lime-600 text-white font-semibold text-xs sm:text-sm uppercase"
            >
              {isAddingNews ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("AddNewsModal.actions.publishing")}
                </>
              ) : (
                t("AddNewsModal.actions.publish")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
