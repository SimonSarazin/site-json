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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NewsFormImageUpload } from "../news/NewsFormImageUpload";
import { TagsInput } from "@/components/form";
import { useT } from "@/hooks/useT";
import { useAddOrganization, OrganizationType, OrganizationRole } from "../../hooks/useOrganizationMutations";
import { toast } from "sonner";
import { useCocolight } from "@/hooks/useCocolight";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AddOrganizationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ORGANIZATION_TYPES: { value: OrganizationType; labelKey: string }[] = [
  { value: "NGO", labelKey: "ngo" },
  { value: "LocalBusiness", labelKey: "localBusiness" },
  { value: "Group", labelKey: "group" },
  { value: "GovernmentOrganization", labelKey: "government" },
  { value: "Cooperative", labelKey: "cooperative" },
];

const ORGANIZATION_ROLES: { value: OrganizationRole; labelKey: string }[] = [
  { value: "admin", labelKey: "admin" },
  { value: "member", labelKey: "member" },
];

export function AddOrganizationModal({ open, onOpenChange }: AddOrganizationModalProps) {
  const t = useT("modules/profil");
  const addOrganizationMutation = useAddOrganization();
  const { me } = useCocolight();

  const [name, setName] = useState("");
  const [type, setType] = useState<OrganizationType>("NGO");
  const [role, setRole] = useState<OrganizationRole>("admin");
  const [shortDescription, setShortDescription] = useState("");
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [images, setImages] = useState<File[]>([]);

  const isAddingOrganization = addOrganizationMutation.isPending;

  const userAvatar = me?.serverData?.profilThumbImageUrl || me?.serverData?.profilImageUrl;
  const userName = me?.serverData?.name || "User";
  const userInitials = userName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error(t("AddOrganizationModal.validation.nameRequired"));
      return;
    }

    if (name.trim().length < 3) {
      toast.error(t("AddOrganizationModal.validation.nameTooShort"));
      return;
    }

    addOrganizationMutation.mutate(
      {
        organizationData: {
          name: name.trim(),
          type,
          role,
          shortDescription: shortDescription.trim() || undefined,
          email: email.trim() || undefined,
          url: url.trim() || undefined,
          tags,
        },
        images,
      },
      {
        onSuccess: () => {
          setName("");
          setType("NGO");
          setRole("admin");
          setShortDescription("");
          setEmail("");
          setUrl("");
          setTags([]);
          setImages([]);
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
            {t("AddOrganizationModal.title")}
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
                {t("AddOrganizationModal.creatingAs")}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="organization-name" className="text-sm sm:text-base font-semibold">
              {t("AddOrganizationModal.form.name.label")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="organization-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("AddOrganizationModal.form.name.placeholder")}
              disabled={isAddingOrganization}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="organization-type" className="text-sm sm:text-base font-semibold">
              {t("AddOrganizationModal.form.type.label")}
            </Label>
            <Select value={type} onValueChange={(value) => setType(value as OrganizationType)} disabled={isAddingOrganization}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("AddOrganizationModal.form.type.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {ORGANIZATION_TYPES.map((orgType) => (
                  <SelectItem key={orgType.value} value={orgType.value}>
                    {t(`AddOrganizationModal.form.type.options.${orgType.labelKey}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="organization-role" className="text-sm sm:text-base font-semibold">
              {t("AddOrganizationModal.form.role.label")} <span className="text-destructive">*</span>
            </Label>
            <Select value={role} onValueChange={(value) => setRole(value as OrganizationRole)} disabled={isAddingOrganization}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("AddOrganizationModal.form.role.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {ORGANIZATION_ROLES.map((orgRole) => (
                  <SelectItem key={orgRole.value} value={orgRole.value}>
                    {t(`AddOrganizationModal.form.role.options.${orgRole.labelKey}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="organization-tags" className="text-sm sm:text-base font-semibold">
              {t("AddOrganizationModal.form.tags.label")}
            </Label>
            <TagsInput
              tags={tags}
              onTagsChange={setTags}
              maxTags={10}
              texts={{
                placeholder: t("AddNewsModal.form.tags.placeholder"),
                maxReached: t("AddNewsModal.form.tags.maxReached", undefined, { max: "{{max}}" }),
                searching: t("tags.searching"),
                noResults: t("tags.noResults"),
                typeToSearch: t("tags.typeToSearch"),
              }}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm sm:text-base font-semibold">
              {t("AddOrganizationModal.form.images.label")}
            </Label>
            <NewsFormImageUpload
              images={images}
              onImagesChange={setImages}
              maxImages={5}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="organization-email" className="text-sm sm:text-base font-semibold">
              {t("AddOrganizationModal.form.email.label")}
            </Label>
            <Input
              id="organization-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("AddOrganizationModal.form.email.placeholder")}
              disabled={isAddingOrganization}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="organization-description" className="text-sm sm:text-base font-semibold">
              {t("AddOrganizationModal.form.shortDescription.label")}
            </Label>
            <Textarea
              id="organization-description"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder={t("AddOrganizationModal.form.shortDescription.placeholder")}
              rows={3}
              disabled={isAddingOrganization}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="organization-url" className="text-sm sm:text-base font-semibold">
              {t("AddOrganizationModal.form.url.label")}
            </Label>
            <Input
              id="organization-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("AddOrganizationModal.form.url.placeholder")}
              disabled={isAddingOrganization}
              className="w-full"
            />
          </div>

          <DialogFooter className="space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isAddingOrganization}
              className="text-xs sm:text-sm uppercase"
            >
              {t("AddOrganizationModal.actions.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isAddingOrganization || !name.trim()}
              className="bg-success hover:bg-success/90 text-success-foreground font-semibold text-xs sm:text-sm uppercase"
            >
              {isAddingOrganization ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("AddOrganizationModal.actions.creating")}
                </>
              ) : (
                t("AddOrganizationModal.actions.create")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
