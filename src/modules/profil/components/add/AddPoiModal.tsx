import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { Loader2 } from "lucide-react";
import { useT } from "@/hooks/useT";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addPoiSchema, type AddPoiFormData } from "../../schemaForm";
import { useAddPoi } from "../../hooks/useAddMutations";
import { TranslatedFormMessage } from "../profile-edit/TranslatedFormMessage";

// Types de POI disponibles
const POI_TYPES = [
  "place",
  "link",
  "tool",
  "machine",
  "software",
  "rh",
  "video",
  "history",
  "something2See",
  "funPlace",
  "artPiece",
  "streetArts",
  "openScene",
  "stand",
  "parking",
  "other",
] as const;

interface AddPoiModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent?: EntityTypes | null;
}

/**
 * Modal pour cr&eacute;er un nouveau POI (Point d'Int&eacute;r&ecirc;t)
 *
 * @param parent - L'entit&eacute; parente (organisation, projet, &eacute;v&eacute;nement)
 */
export function AddPoiModal({ open, onOpenChange, parent }: AddPoiModalProps) {
  const t = useT("modules/profil");
  const addMutation = useAddPoi(parent);

  const form = useForm<AddPoiFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(addPoiSchema) as any,
    defaultValues: {
      name: "",
      type: "place",
      description: "",
    },
  });

  const onSubmit = async (data: AddPoiFormData) => {
    try {
      await addMutation.mutateAsync(data);
      form.reset();
      onOpenChange(false);
    } catch {
      // Error handling is done in the mutation
    }
  };

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  // Traductions des types de POI
  const getPoiTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      place: "Lieu",
      link: "Lien",
      tool: "Outil",
      machine: "Machine",
      software: "Logiciel",
      rh: "Ressource humaine",
      video: "Vid&eacute;o",
      history: "Histoire",
      something2See: "&Agrave; voir",
      funPlace: "Lieu sympa",
      artPiece: "Oeuvre d'art",
      streetArts: "Art de rue",
      openScene: "Sc&egrave;ne ouverte",
      stand: "Stand",
      parking: "Parking",
      other: "Autre",
    };
    return labels[type] || type;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("AddEntity.modal.poi.title")}</DialogTitle>
          <DialogDescription>
            {t("AddEntity.modal.poi.description")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Nom */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("ProfileEdit.fields.name.label")} *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("ProfileEdit.fields.name.placeholder")}
                      {...field}
                    />
                  </FormControl>
                  <TranslatedFormMessage />
                </FormItem>
              )}
            />

            {/* Type de POI */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="S&eacute;lectionner un type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {POI_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {getPoiTypeLabel(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <TranslatedFormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("ProfileEdit.fields.description.label")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("ProfileEdit.fields.description.placeholder")}
                      className="resize-none"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <TranslatedFormMessage />
                </FormItem>
              )}
            />

            {/* Parent affich&eacute; en lecture seule si fourni */}
            {parent && (
              <div className="text-sm text-muted-foreground">
                {t("ProfileEdit.fields.parent.label")}: <strong>{parent.serverData?.name}</strong>
              </div>
            )}

            <DialogFooter>
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
