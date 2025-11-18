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

interface AddNewsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddNewsModal({ open, onOpenChange }: AddNewsModalProps) {
  const t = useT("modules/profil");

  const [text, setText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!text.trim()) {
      alert(t("AddNewsModal.validation.textRequired"));
      return;
    }

    if (text.trim().length < 3) {
      alert(t("AddNewsModal.validation.textTooShort"));
      return;
    }

    try {

      setText("");
      setTags([]);
      setImages([]);
      setDocuments([]);

      onOpenChange(false);
    } catch (error) {
      console.error("Erreur lors de l'ajout de la news:", error);
      alert(t("AddNewsModal.error"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">
            {t("AddNewsModal.title")}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            {t("AddNewsModal.description")}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <Label htmlFor="news-text" className="text-sm sm:text-base">
              {t("AddNewsModal.form.text.label")} <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="news-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("AddNewsModal.form.text.placeholder")}
              rows={5}
              className="resize-none text-sm sm:text-base"
              disabled={false}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm sm:text-base">
              {t("AddNewsModal.form.tags.label")}
            </Label>
            <NewsFormTagsInput
              tags={tags}
              onTagsChange={setTags}
              maxTags={10}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm sm:text-base">
              {t("AddNewsModal.form.images.label")}
            </Label>
            <NewsFormImageUpload
              images={images}
              onImagesChange={setImages}
              maxImages={10}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm sm:text-base">
              {t("AddNewsModal.form.documents.label")}
            </Label>
            <NewsFormDocumentUpload
              documents={documents}
              onDocumentsChange={setDocuments}
              maxDocuments={5}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={false}
              className="text-xs sm:text-sm"
            >
              {t("AddNewsModal.actions.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={false || !text.trim()}
              className="bg-[#0092a2] hover:bg-teal-600 text-xs sm:text-sm"
            >
              {false ? (
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
