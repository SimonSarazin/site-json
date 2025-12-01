import { useState } from "react";
import { Loader2, Globe, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NewsFormImageUpload } from "../news/NewsFormImageUpload";
import { NewsFormTagsInput } from "../news/NewsFormTagsInput";
import { useT } from "@/hooks/useT";
import { useAddProject } from "../../hooks/useProjectMutations";
import { EntityTypes } from "@communecter/cocolight-api-client";
import { toast } from "sonner";
import { useCocolight } from "@/hooks/useCocolight";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface AddProjectModalProps {
  entity: EntityTypes;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddProjectModal({ entity, open, onOpenChange }: AddProjectModalProps) {
  const t = useT("modules/profil");
  const addProjectMutation = useAddProject(entity);
  const { me } = useCocolight();

  const [name, setName] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [isPublic, setIsPublic] = useState(true);

  const isAddingProject = addProjectMutation.isPending;

  const userAvatar = me?.serverData?.profilThumbImageUrl || me?.serverData?.profilImageUrl;
  const userName = me?.serverData?.name || "User";
  const userInitials = userName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error(t("AddProjectModal.validation.nameRequired"));
      return;
    }

    if (name.trim().length < 3) {
      toast.error(t("AddProjectModal.validation.nameTooShort"));
      return;
    }

    addProjectMutation.mutate(
      {
        projectData: {
          name: name.trim(),
          shortDescription: shortDescription.trim() || undefined,
          url: url.trim() || undefined,
          tags,
          isPublic,
        },
        images,
      },
      {
        onSuccess: () => {
          // Reset form
          setName("");
          setShortDescription("");
          setUrl("");
          setTags([]);
          setImages([]);
          setIsPublic(true);
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">
            {t("AddProjectModal.title")}
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
              <p className="text-xs text-muted-foreground">
                {t("AddProjectModal.creatingAs")}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-name" className="text-sm sm:text-base font-semibold">
              {t("AddProjectModal.form.name.label")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("AddProjectModal.form.name.placeholder")}
              disabled={isAddingProject}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm sm:text-base font-semibold">
              {t("AddProjectModal.form.visibility.label")}
            </Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={isPublic ? "default" : "outline"}
                onClick={() => setIsPublic(true)}
                disabled={isAddingProject}
                className={cn(
                  "flex-1",
                  isPublic && "bg-lime-700 hover:bg-lime-600 text-white"
                )}
              >
                <Globe className="w-4 h-4 mr-2" />
                {t("AddProjectModal.form.visibility.public")}
              </Button>
              <Button
                type="button"
                variant={!isPublic ? "default" : "outline"}
                onClick={() => setIsPublic(false)}
                disabled={isAddingProject}
                className={cn(
                  "flex-1",
                  !isPublic && "bg-gray-700 hover:bg-gray-600 text-white"
                )}
              >
                <Lock className="w-4 h-4 mr-2" />
                {t("AddProjectModal.form.visibility.private")}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm sm:text-base font-semibold">
              {t("AddProjectModal.form.images.label")}
            </Label>
            <NewsFormImageUpload
              images={images}
              onImagesChange={setImages}
              maxImages={5}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description" className="text-sm sm:text-base font-semibold">
              {t("AddProjectModal.form.shortDescription.label")}
            </Label>
            <Textarea
              id="project-description"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder={t("AddProjectModal.form.shortDescription.placeholder")}
              rows={3}
              disabled={isAddingProject}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-url" className="text-sm sm:text-base font-semibold">
              {t("AddProjectModal.form.url.label")}
            </Label>
            <Input
              id="project-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("AddProjectModal.form.url.placeholder")}
              disabled={isAddingProject}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-tags" className="text-sm sm:text-base font-semibold">
              {t("AddProjectModal.form.tags.label")}
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
              disabled={isAddingProject}
              className="text-xs sm:text-sm uppercase"
            >
              {t("AddProjectModal.actions.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isAddingProject || !name.trim()}
              className="bg-lime-700 hover:bg-lime-600 text-white font-semibold text-xs sm:text-sm uppercase"
            >
              {isAddingProject ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("AddProjectModal.actions.creating")}
                </>
              ) : (
                t("AddProjectModal.actions.create")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
