import { useState, useEffect, useRef } from "react";
import { Loader2, Globe, Lock, Users, SmilePlus } from "lucide-react";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { useTheme } from "next-themes";
import { useLocalization } from "@/hooks/useLocalization";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NewsFormImageUpload } from "./NewsFormImageUpload";
import { NewsFormDocumentUpload } from "./NewsFormDocumentUpload";
import { NewsFormTagsInput } from "./NewsFormTagsInput";
import { useT } from "@/hooks/useT";
import { useAddNews } from "../../hooks/useAddNews";
import { useCocolight } from "@/hooks/useCocolight";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AddNewsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddNewsModal({ open, onOpenChange }: AddNewsModalProps) {
  const t = useT("modules/profil");
  const { addNewsAsync, isAddingNews, isSuccess } = useAddNews();
  const { me } = useCocolight();
  const { theme } = useTheme();
  const { currentLocale } = useLocalization();

  const [text, setText] = useState("");
  const [scope, setScope] = useState<"public" | "private" | "restricted">("public");
  const [tags, setTags] = useState<string[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setText((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const userAvatar = me?.serverData?.profilThumbImageUrl || me?.serverData?.profilImageUrl;
  const userName = me?.serverData?.name || "User";
  const userInitials = userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const getScopeIcon = () => {
    switch (scope) {
      case "public": return <Globe className="w-4 h-4" />;
      case "private": return <Lock className="w-4 h-4" />;
      case "restricted": return <Users className="w-4 h-4" />;
    }
  };

  useEffect(() => {
    if (isSuccess) {
      setText("");
      setScope("public");
      setTags([]);
      setImages([]);
      setDocuments([]);
      onOpenChange(false);
    }
  }, [isSuccess, onOpenChange]);

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
      await addNewsAsync({
        text: text.trim(),
        tags,
        scope,
        images,
        documents,
      });
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
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
            <Avatar className="h-10 w-10 sm:h-12 sm:w-12 ring-2 ring-primary/20">
              <AvatarImage src={userAvatar} alt={userName} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium text-sm sm:text-base text-foreground truncate">
                {userName}
              </p>
              <div className="flex items-center mt-1 w-full">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  {getScopeIcon()}
                </div>
                <select
                  id="news-scope"
                  value={scope}
                  onChange={(e) => setScope(e.target.value as "public" | "private" | "restricted")}
                  disabled={isAddingNews}
                  className="text-xs sm:text-sm bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer text-muted-foreground transition-colors p-0 w-full"
                >
                  <option value="public" className="bg-background text-foreground">{t("AddNewsModal.form.scope.public")}</option>
                  <option value="restricted" className="bg-background text-foreground">{t("AddNewsModal.form.scope.restricted")}</option>
                  <option value="private" className="bg-background text-foreground">{t("AddNewsModal.form.scope.private")}</option>
                </select>
              </div>
            </div>
          </div>

          <div className="relative">
            <Textarea
              id="news-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("AddNewsModal.form.text.placeholder")}
              rows={5}
              className="resize-none text-sm sm:text-base border-0 bg-transparent focus-visible:ring-0 p-2 pb-10 placeholder:text-muted-foreground/60"
              disabled={isAddingNews}
            />
            <div className="absolute bottom-2 right-2" ref={emojiPickerRef}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                disabled={isAddingNews}
              >
                <SmilePlus className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {showEmojiPicker && (
            <div
              ref={emojiPickerRef}
              className="fixed inset-0 z-100 flex items-center justify-center bg-black/20"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowEmojiPicker(false);
                }
              }}
            >
              <div onClick={(e) => e.stopPropagation()}>
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  theme={theme === "dark" ? Theme.DARK : Theme.LIGHT}
                  width={320}
                  height={400}
                  searchPlaceHolder={currentLocale === "fr" ? "Rechercher..." : "Search..."}
                  previewConfig={{ showPreview: false }}
                />
              </div>
            </div>
          )}

          <div className="border-t border-border pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NewsFormImageUpload
                images={images}
                onImagesChange={setImages}
                maxImages={10}
              />
              <NewsFormDocumentUpload
                documents={documents}
                onDocumentsChange={setDocuments}
                maxDocuments={5}
              />
            </div>

            {/* Tags */}
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
