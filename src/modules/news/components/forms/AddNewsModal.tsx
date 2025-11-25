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
import { Label } from "@/components/ui/label";
import { MentionInput } from "../mention/MentionInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NewsFormImageUpload } from "./NewsFormImageUpload";
import { NewsFormDocumentUpload } from "./NewsFormDocumentUpload";
import { NewsFormTagsInput } from "./NewsFormTagsInput";
import { useT } from "@/hooks/useT";
import { useAddNews, useAddNewsMention } from "../../hooks/useNewsMutations";
import { EntityTypes } from "@communecter/cocolight-api-client";
import { toast } from "sonner";
import { useCocolight } from "@/hooks/useCocolight";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AddNewsModalProps {
  entity: EntityTypes,
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddNewsModal({ entity, open, onOpenChange }: AddNewsModalProps) {
  const t = useT("modules/news");
  const addNewsMutation = useAddNews(entity);
  const addMentionMutation = useAddNewsMention(entity);
  const { me } = useCocolight();
  const { theme } = useTheme();
  const { currentLocale } = useLocalization();

  const [text, setText] = useState("");
  const [scope, setScope] = useState<"public" | "private" | "restricted">("public");
  const [tags, setTags] = useState<string[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const [mentionedSlugs, setMentionedSlugs] = useState<string[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const isAddingNews = addNewsMutation.isPending;

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

  const handleMentionAdd = (slug: string) => {
    if (!mentionedSlugs.includes(slug)) {
      setMentionedSlugs([...mentionedSlugs, slug]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!text.trim()) {
      toast.error(t("validation.textRequired"));
      return;
    }

    if (text.trim().length < 3) {
      toast.error(t("validation.textTooShort"));
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
        onSuccess: ({ news }) => {
          // Ajouter les mentions si il y en a
          if (mentionedSlugs.length > 0 && news) {
            mentionedSlugs.forEach((slug) => {
              addMentionMutation.mutate({ news, slug });
            });
          }

          // Reset form
          setText("");
          setScope("public");
          setTags([]);
          setImages([]);
          setDocuments([]);
          setMentionedSlugs([]);
          onOpenChange(false);
        },
      });

  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">
            {t("forms.addNews.title")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar + Scope selector */}
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
              <div className="flex items-center gap-2 mt-1">
                <Label htmlFor="news-scope" className="text-xs text-muted-foreground flex items-center gap-1.5 cursor-pointer">
                  {getScopeIcon()}
                  <span>{t("forms.scope.label")}</span>
                </Label>
              </div>
            </div>
          </div>

          {/* Scope Select with icons */}
          <div className="space-y-2">
            <Select
              value={scope}
              onValueChange={(value) => setScope(value as "public" | "private" | "restricted")}
              disabled={isAddingNews}
            >
              <SelectTrigger id="news-scope" className="w-full">
                <SelectValue placeholder={t("forms.scope.label")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    <span>{t("forms.scope.public")}</span>
                  </div>
                </SelectItem>
                <SelectItem value="restricted">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>{t("forms.scope.restricted")}</span>
                  </div>
                </SelectItem>
                <SelectItem value="private">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    <span>{t("forms.scope.private")}</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Text area with mention support + emoji */}
          <div className="space-y-2">
            <Label htmlFor="news-text" className="text-sm sm:text-base font-semibold">
              {t("forms.addNews.textLabel")} <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <MentionInput
                value={text}
                onChange={setText}
                onMentionAdd={handleMentionAdd}
                placeholder={t("forms.addNews.textPlaceholder")}
                rows={6}
                className="resize-none"
                disabled={isAddingNews}
              />
              <div className="absolute bottom-2 right-2">
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
          </div>

          {showEmojiPicker && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowEmojiPicker(false);
                }
              }}
            >
              <div ref={emojiPickerRef} onClick={(e) => e.stopPropagation()}>
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
            <div className="space-y-2">
              <Label htmlFor="news-tags" className="text-sm sm:text-base font-semibold">
                {t("forms.tagsInput.label")}
              </Label>
              <NewsFormTagsInput
                tags={tags}
                onTagsChange={setTags}
                maxTags={10}
              />
            </div>
          </div>

          <DialogFooter className="space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isAddingNews}
              className="text-xs sm:text-sm uppercase"
            >
              {t("forms.addNews.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isAddingNews || !text.trim()}
              className="bg-lime-700 hover:bg-lime-600 text-white font-semibold text-xs sm:text-sm uppercase"
            >
              {isAddingNews ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("forms.addNews.posting")}
                </>
              ) : (
                t("forms.addNews.post")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}