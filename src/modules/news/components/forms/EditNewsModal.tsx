import { useState, useEffect, useRef } from "react";
import { Loader2, Edit, Globe, Lock, Users, SmilePlus, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MentionInput } from "../mention/MentionInput";
import { NewsFormImageUpload } from "./NewsFormImageUpload";
import { NewsFormDocumentUpload } from "./NewsFormDocumentUpload";
import { TagsInput } from "@/components/form";
import { useT } from "@/hooks/useT";
import { useEditNews, useAddNewsMention } from "../../hooks/useNewsMutations";
import type { News, EntityTypes } from "@communecter/cocolight-api-client";
import { toast } from "sonner";
import { useCocolight } from "@/hooks/useCocolight";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { NewsImageItem, NewsDocumentItem } from "../../types";

interface EditNewsModalProps {
  entity: EntityTypes;
  news: News | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditNewsModal({ entity, news, open, onOpenChange }: EditNewsModalProps) {
  const t = useT("modules/news");
  const editNewsMutation = useEditNews(entity);
  const addMentionMutation = useAddNewsMention(entity);
  const { me } = useCocolight();
  const { theme } = useTheme();
  const { currentLocale } = useLocalization();

  // Extract current values from news
  const getCurrentScope = () => {
    if (!news?.serverData?.scope) return "public";
    if (typeof news.serverData.scope === 'object') {
      return (news.serverData.scope as Record<string, unknown>).type as string || 'public';
    }
    return 'public';
  };

  const getCurrentTags = () => {
    if (!news?.serverData?.tags) return [];
    return Array.isArray(news.serverData.tags) ? news.serverData.tags as string[] : [];
  };

  const getCurrentMentions = () => {
    if (!news?.serverData?.mentions) return [];
    return Array.isArray(news.serverData.mentions)
      ? (news.serverData.mentions as Array<{slug: string}>).map(m => m.slug)
      : [];
  };

  // State initialization - will be reset by useEffect when news changes
  const [text, setText] = useState("");
  const [scope, setScope] = useState<"public" | "private" | "restricted">("public");
  const [tags, setTags] = useState<string[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const [mentionedSlugs, setMentionedSlugs] = useState<string[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
  const [documentsToDelete, setDocumentsToDelete] = useState<string[]>([]);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const isEditing = editNewsMutation.isPending;

  // Reset form when news changes (new modal open)
  useEffect(() => {
    if (news) {
      setText(news.serverData?.text || "");

      // Get current scope
      let currentScope = "public";
      if (news.serverData?.scope) {
        if (typeof news.serverData.scope === 'object') {
          currentScope = (news.serverData.scope as Record<string, unknown>).type as string || 'public';
        } else {
          currentScope = 'public';
        }
      }
      setScope(currentScope as "public" | "private" | "restricted");

      // Get current tags
      const currentTags = news.serverData?.tags && Array.isArray(news.serverData.tags)
        ? news.serverData.tags as string[]
        : [];
      setTags(currentTags);

      // Get current mentions
      const currentMentions = news.serverData?.mentions && Array.isArray(news.serverData.mentions)
        ? (news.serverData.mentions as Array<{slug: string}>).map(m => m.slug)
        : [];
      setMentionedSlugs(currentMentions);

      // Always reset file arrays
      setImages([]);
      setDocuments([]);
      setImagesToDelete([]);
      setDocumentsToDelete([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [news?.id]); // Only depend on news ID to avoid re-runs when news object reference changes

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

  // Event handlers from AddNewsModal
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

    if (!news) return;

    if (!text.trim()) {
      toast.error(t("validation.textRequired"));
      return;
    }

    if (text.trim().length < 3) {
      toast.error(t("validation.textTooShort"));
      return;
    }

    // Handle file deletions before saving
    // Clone draftData to avoid mutating the original news object directly
    const draftData = { ...news.draftData };

    if (imagesToDelete.length > 0 || documentsToDelete.length > 0) {
      // Remove deleted images from data.mediaImg.images
      if (imagesToDelete.length > 0 && draftData.mediaImg?.images) {
        const filteredImages = draftData.mediaImg.images.filter(
          (imageId: string) => !imagesToDelete.includes(imageId)
        );
        draftData.mediaImg = {
          ...draftData.mediaImg,
          images: filteredImages,
          countImages: filteredImages.length,
        };
      }

      // Remove deleted documents from data.mediaFile
      if (documentsToDelete.length > 0 && draftData.mediaFile?.files) {
        const filteredFiles = draftData.mediaFile.files.filter(
          (docId: string) => !documentsToDelete.includes(docId)
        );
        draftData.mediaFile = {
          ...draftData.mediaFile,
          files: filteredFiles,
          countFiles: filteredFiles.length,
        };
      }

      // Apply cloned draftData back to news
      Object.assign(news.draftData, draftData);
    }

    editNewsMutation.mutate(
      {
        news,
        newsData: {
          text: text.trim(),
          tags,
          scope,
        },
        images,
        documents,
      },
      {
        onSuccess: ({ news: updatedNews }) => {
          // Add new mentions if any
          if (mentionedSlugs.length > 0 && updatedNews) {
            mentionedSlugs.forEach((slug) => {
              if (!getCurrentMentions().includes(slug)) {
                addMentionMutation.mutate({ news: updatedNews, slug });
              }
            });
          }
          onOpenChange(false);
        },
      }
    );
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isEditing) {
      if (!newOpen) {
        // Reset to original values
        setText(news?.serverData?.text || "");
        setScope(getCurrentScope() as "public" | "private" | "restricted");
        setTags(getCurrentTags());
        setImages([]);
        setDocuments([]);
        setMentionedSlugs(getCurrentMentions());
        setImagesToDelete([]);
        setDocumentsToDelete([]);
      }
      onOpenChange(newOpen);
    }
  };

  if (!news) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5 text-blue-500" />
            {t("forms.editNews.title")}
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
                <Label htmlFor="edit-news-scope" className="text-xs text-muted-foreground flex items-center gap-1.5 cursor-pointer">
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
              disabled={isEditing}
            >
              <SelectTrigger id="edit-news-scope" className="w-full">
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
              {t("forms.editNews.textLabel")} <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <MentionInput
                value={text}
                onChange={setText}
                onMentionAdd={handleMentionAdd}
                placeholder={t("forms.editNews.textPlaceholder")}
                rows={6}
                className="resize-none"
                disabled={isEditing}
              />
              <div className="absolute bottom-2 right-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  disabled={isEditing}
                >
                  <SmilePlus className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>

          {showEmojiPicker && (
            <div
              className="fixed inset-0 z-100 flex items-center justify-center bg-black/20"
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
            {/* Existing images */}
            {news?.serverData?.mediaImg?.images && news.serverData.mediaImg.images.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm sm:text-base font-semibold">
                  Images existantes
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {news.serverData.mediaImg.images
                    .filter((image: NewsImageItem) => !image.id || !imagesToDelete.includes(image.id))
                    .map((image: NewsImageItem) => (
                    <div key={image.id} className="relative group">
                      <div className="aspect-square relative">
                        <img
                          src={image.imageThumbPath || image.imagePath}
                          alt={image.name || 'Image'}
                          className="w-full h-full object-cover rounded-lg border border-border"
                        />
                        <button
                          type="button"
                          onClick={() => image.id && setImagesToDelete([...imagesToDelete, image.id])}
                          className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Supprimer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Existing documents */}
            {news?.serverData?.mediaFile?.files && news.serverData.mediaFile.files.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm sm:text-base font-semibold">
                  Documents existants
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {news.serverData.mediaFile.files
                    .filter((document: NewsDocumentItem) => !document.id || !documentsToDelete.includes(document.id))
                    .map((document: NewsDocumentItem) => (
                    <div key={document.id} className="relative group">
                      <div className="p-3 border border-border rounded-lg bg-muted/50 relative">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
                            <span className="text-xs font-medium text-primary">
                              {document.name?.split('.').pop()?.toUpperCase() || 'DOC'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">
                              {document.name || 'Document'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {document.size ? `${Math.round(document.size / 1024)} KB` : ''}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => document.id && setDocumentsToDelete([...documentsToDelete, document.id])}
                          className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Supprimer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New files upload */}
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
              <TagsInput
                tags={tags}
                onTagsChange={setTags}
                maxTags={10}
                texts={{
                  placeholder: t("forms.tagsInput.placeholder"),
                  maxReached: t("forms.tagsInput.maxReached"),
                  searching: t("tags.searching"),
                  noResults: t("tags.noResults"),
                  typeToSearch: t("tags.typeToSearch"),
                }}
              />
            </div>
          </div>

          <DialogFooter className="space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isEditing}
              className="text-xs sm:text-sm uppercase"
            >
              {t("forms.editNews.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isEditing || !text.trim()}
              className="bg-lime-700 hover:bg-lime-600 text-white font-semibold text-xs sm:text-sm uppercase"
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