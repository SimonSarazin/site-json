import { useCallback, useState, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, AlertCircle } from "lucide-react";
import type { FieldErrors, FieldValues, Resolver, UseFormReturn } from "react-hook-form";
import { useT } from "@/hooks/useT";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addTransparentCommuneSchema,
  type AddTransparentCommuneFormData,
} from "../../schemaForm";
import { useAddTransparentCommune } from "../../hooks/useAddMutations";
import { TranslatedFormMessage } from "../profile-edit/fields/TranslatedFormMessage";
import { EditLocationTab } from "../profile-edit/EditLocationTab";
import {
  FormFieldName,
  FormFieldTags,
  FormFieldShortDescription,
  FormFieldUrl,
  ParentInfoReadonly,
} from "../profile-edit/fields";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { MultiSelectThematics } from "./MultiSelectThematics";

const TAB_FIELDS = {
  info: [
    "name",
    "role",
    "tags",
    "bannerImageUrl",
    "bannerLogoUrl",
    "bannerText",
    "shortDescription",
    "selectedThematics",
    "email",
    "url",
  ],
  location: [
    "addressCountry",
    "addressLocality",
    "postalCode",
    "streetAddress",
    "localityId",
  ],
} as const;

type TabName = keyof typeof TAB_FIELDS;

type ImageFieldName = "bannerImageUrl" | "bannerLogoUrl";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasTabErrors(tabName: TabName, errors: FieldErrors<any>): boolean {
  return TAB_FIELDS[tabName].some(field => !!errors[field]);
}

interface AddCTModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent?: EntityTypes | null;
}

export function AddCTModal({ open, onOpenChange, parent }: AddCTModalProps) {
  const t = useT("modules/profil");
  const addMutation = useAddTransparentCommune();
  const [uploadingField, setUploadingField] = useState<ImageFieldName | null>(null);

  const form = useForm<AddTransparentCommuneFormData>({
    resolver: zodResolver(addTransparentCommuneSchema) as Resolver<AddTransparentCommuneFormData>,
    defaultValues: {
      name: "",
      type: "NGO",
      role: "admin",
      shortDescription: "",
      email: undefined,
      url: "",
      tags: [],
      addressCountry: "",
      addressLocality: "",
      localityId: "",
      postalCode: "",
      streetAddress: "",
      bannerImageUrl: "",
      bannerLogoUrl: "",
      bannerText: "",
      selectedThematics: [],
    },
  });

  const uploadImageFile = useCallback(async (fieldName: ImageFieldName, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(t("AddEntity.modal.transparentCommune.uploadInvalid"));
      return;
    }

    setUploadingField(fieldName);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/upload-image", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => undefined)) as
        | { path?: string; error?: string }
        | undefined;
      if (!response.ok || !payload || typeof payload.path !== "string") {
        const errorMessage = payload?.error || response.statusText;
        throw new Error(errorMessage);
      }

      form.setValue(fieldName, payload.path, { shouldValidate: true, shouldDirty: true });
      toast.success(t("AddEntity.modal.transparentCommune.uploadSuccess"));
    } catch (error) {
      console.error("Image upload failed:", error);
      toast.error(t("AddEntity.modal.transparentCommune.uploadError"));
    } finally {
      setUploadingField(null);
    }
  }, [form, t]);

  const handleFileInputChange = useCallback((fieldName: ImageFieldName) => async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadImageFile(fieldName, file);
    event.target.value = "";
  }, [uploadImageFile]);

  const onSubmit = async (data: AddTransparentCommuneFormData) => {
    try {
      await addMutation.mutateAsync(data);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating transparent commune:", error);
      if (error && typeof error === "object") {
        console.error("Error details:", {
          message: (error as Record<string, unknown>).message,
          validationErrors: (error as Record<string, unknown>).validationErrors,
          details: (error as Record<string, unknown>).details,
          response: (error as Record<string, unknown>).response,
          data: (error as Record<string, unknown>).data,
        });
      }
    }
  };

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("AddEntity.modal.transparentCommune.title")}</DialogTitle>
          <DialogDescription>
            {t("AddEntity.modal.transparentCommune.description")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
            <Tabs defaultValue="info" className="w-full flex-1 flex flex-col min-h-0">
              <div className="overflow-x-auto scrollbar-hide -mx-6 px-6 shrink-0">
                <TabsList className="w-max min-w-full flex">
                  <TabsTrigger value="info" className="shrink-0 gap-1 px-2 sm:px-3 text-xs sm:text-sm">
                    {t("AddEntity.tabs.info")}
                    {hasTabErrors('info', form.formState.errors) && (
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="location" className="shrink-0 gap-1 px-2 sm:px-3 text-xs sm:text-sm">
                    {t("AddEntity.tabs.location")}
                    {hasTabErrors('location', form.formState.errors) && (
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="mt-4 flex-1 overflow-y-auto pr-4">
                <TabsContent value="info" className="space-y-4">
                  <ParentInfoReadonly parent={parent} />

                  <FormFieldName control={form.control} required showDescription />

                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("InviteMemberDialog.role")} *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={t("InviteMemberDialog.selectRole")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="admin">{t("InviteMemberDialog.badges.admin")}</SelectItem>
                            <SelectItem value="member">{t("InviteMemberDialog.badges.member")}</SelectItem>
                          </SelectContent>
                        </Select>
                        <TranslatedFormMessage />
                      </FormItem>
                    )}
                  />

                  <FormFieldTags control={form.control} extendedTexts />

                  <FormField
                    control={form.control}
                    name="selectedThematics"
                    render={({ field }) => {
                      const selectedValues = field.value ?? [];
                      return (
                        <FormItem>
                          <FormLabel>Thématiques activées</FormLabel>
                          <FormControl>
                            <MultiSelectThematics
                              value={selectedValues}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            Sélectionnez une ou plusieurs thématiques pour initialiser thematic et filiere.
                          </p>
                          <TranslatedFormMessage />
                        </FormItem>
                      );
                    }}
                  />

                  <FormField
                    control={form.control}
                    name="bannerImageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("ProfileEdit.fields.bannerImageUrl.label")}</FormLabel>
                        <div className="space-y-2">
                          <FormControl>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                type="file"
                                accept="image/*"
                                className="max-w-xs"
                                disabled={uploadingField === "bannerImageUrl"}
                                onChange={handleFileInputChange("bannerImageUrl")}
                              />
                              {uploadingField === "bannerImageUrl" && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  {t("common.loading")}
                                </div>
                              )}
                            </div>
                          </FormControl>
                          {field.value && (
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-medium">
                                {t("AddEntity.modal.transparentCommune.currentPath")}:
                              </span>
                              <span className="font-mono break-all text-foreground">
                                {field.value as string}
                              </span>
                              <Button
                                type="button"
                                variant="link"
                                size="sm"
                                className="px-0"
                                onClick={() => {
                                  if (typeof window !== "undefined" && field.value) {
                                    window.open(field.value as string, "_blank");
                                  }
                                }}
                              >
                                {t("ProfileEdit.fields.bannerImageUrl.preview")}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => field.onChange("")}
                              >
                                {t("AddEntity.modal.transparentCommune.clearImage")}
                              </Button>
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {t("ProfileEdit.fields.bannerImageUrl.uploadHint")}
                          </p>
                        </div>
                        <TranslatedFormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bannerLogoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("ProfileEdit.fields.bannerLogoUrl.label")}</FormLabel>
                        <div className="space-y-2">
                          <FormControl>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                type="file"
                                accept="image/*"
                                className="max-w-xs"
                                disabled={uploadingField === "bannerLogoUrl"}
                                onChange={handleFileInputChange("bannerLogoUrl")}
                              />
                              {uploadingField === "bannerLogoUrl" && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  {t("common.loading")}
                                </div>
                              )}
                            </div>
                          </FormControl>
                          {field.value && (
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-medium">
                                {t("AddEntity.modal.transparentCommune.currentPath")}:
                              </span>
                              <span className="font-mono break-all text-foreground">
                                {field.value as string}
                              </span>
                              <Button
                                type="button"
                                variant="link"
                                size="sm"
                                className="px-0"
                                onClick={() => {
                                  if (typeof window !== "undefined" && field.value) {
                                    window.open(field.value as string, "_blank");
                                  }
                                }}
                              >
                                {t("ProfileEdit.fields.bannerLogoUrl.preview")}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => field.onChange("")}
                              >
                                {t("AddEntity.modal.transparentCommune.clearImage")}
                              </Button>
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {t("ProfileEdit.fields.bannerLogoUrl.uploadHint")}
                          </p>
                        </div>
                        <TranslatedFormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bannerText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("ProfileEdit.fields.bannerText.label")}</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={3}
                            placeholder={t("ProfileEdit.fields.bannerText.placeholder") ?? ""}
                            {...field}
                          />
                        </FormControl>
                        <TranslatedFormMessage />
                      </FormItem>
                    )}
                  />

                  <FormFieldShortDescription control={form.control} showDescription />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("ProfileEdit.fields.email.label")}</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder={t("ProfileEdit.fields.email.placeholder")}
                            {...field}
                          />
                        </FormControl>
                        <TranslatedFormMessage />
                      </FormItem>
                    )}
                  />

                  <FormFieldUrl control={form.control} showDescription />
                </TabsContent>

                <TabsContent value="location">
                  <EditLocationTab form={form as unknown as UseFormReturn<FieldValues>} />
                </TabsContent>
              </div>
            </Tabs>

            <DialogFooter className="mt-6 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={addMutation.isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={addMutation.isPending}>
                {addMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("ProfileEdit.saving")}
                  </>
                ) : (
                  t("AddEntity.create")
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
