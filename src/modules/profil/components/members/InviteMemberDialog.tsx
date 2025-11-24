import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useT } from "@/hooks/useT";
import { useInviteMember } from "../../hooks/useMemberMutations";
import { isOrganization, isProject, isEvent } from "@/lib/getTypedEntity";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, X } from "lucide-react";

const InviteMemberFormSchema = z.object({
  emails: z.string().min(1, "Au moins une adresse email est requise"),
  role: z.string().min(1, "Le rôle est requis"),
});

type InviteMemberFormData = z.infer<typeof InviteMemberFormSchema>;

interface InviteMemberDialogProps {
  entity: EntityTypes | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteMemberDialog({ entity, open, onOpenChange }: InviteMemberDialogProps) {
  const t = useT("modules/profil");
  const [emailList, setEmailList] = useState<string[]>([]);
  const [currentEmail, setCurrentEmail] = useState("");

  const inviteMutation = useInviteMember(entity);

  const form = useForm<InviteMemberFormData>({
    resolver: zodResolver(InviteMemberFormSchema),
    defaultValues: {
      emails: "",
      role: "member",
    },
  });

  // Déterminer les rôles disponibles selon le type d'entité
  const getAvailableRoles = () => {
    if (entity && isOrganization(entity)) {
      return [
        { value: "member", label: t("ProfileMembers.organization.member") },
        { value: "admin", label: t("ProfileMembers.organization.admin") },
      ];
    } else if (entity && isProject(entity)) {
      return [
        { value: "contributor", label: t("ProfileMembers.project.contributor") },
        { value: "admin", label: t("ProfileMembers.project.admin") },
      ];
    } else if (entity && isEvent(entity)) {
      return [
        { value: "participant", label: t("ProfileMembers.event.participant") },
      ];
    }
    return [];
  };

  const getEntityLabels = () => {
    if (entity && isOrganization(entity)) {
      return {
        title: t("InviteMemberDialog.organization.title"),
        description: t("InviteMemberDialog.organization.description"),
      };
    } else if (entity && isProject(entity)) {
      return {
        title: t("InviteMemberDialog.project.title"),
        description: t("InviteMemberDialog.project.description"),
      };
    } else if (entity && isEvent(entity)) {
      return {
        title: t("InviteMemberDialog.event.title"),
        description: t("InviteMemberDialog.event.description"),
      };
    }
    return {
      title: t("InviteMemberDialog.title"),
      description: t("InviteMemberDialog.description"),
    };
  };

  const labels = getEntityLabels();
  const roles = getAvailableRoles();

  const handleAddEmail = () => {
    const email = currentEmail.trim();
    if (email && !emailList.includes(email) && isValidEmail(email)) {
      setEmailList([...emailList, email]);
      setCurrentEmail("");
      form.setValue("emails", [...emailList, email].join(", "));
    }
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    const newEmailList = emailList.filter(email => email !== emailToRemove);
    setEmailList(newEmailList);
    form.setValue("emails", newEmailList.join(", "));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddEmail();
    }
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const onSubmit = async (data: InviteMemberFormData) => {
    if (emailList.length === 0) {
      form.setError("emails", {
        message: t("InviteMemberDialog.noEmailsError")
      });
      return;
    }

    try {
      // Envoyer les invitations une par une
      for (const email of emailList) {
        await inviteMutation.mutateAsync({
          email,
          role: data.role,
        });
      }

      // Réinitialiser et fermer
      form.reset();
      setEmailList([]);
      setCurrentEmail("");
      onOpenChange(false);
    } catch (error) {
      // Les erreurs sont gérées par les mutations
    }
  };

  const handleClose = () => {
    form.reset();
    setEmailList([]);
    setCurrentEmail("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <UserPlus className="h-5 w-5" />
            <span>{labels.title}</span>
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                {labels.description}
              </p>

              {/* Email input */}
              <div className="space-y-3">
                <FormLabel>
                  {t("InviteMemberDialog.emailAddresses")}
                </FormLabel>

                {/* Liste des emails ajoutés */}
                {emailList.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-gray-50">
                    {emailList.map((email) => (
                      <Badge key={email} variant="secondary" className="flex items-center gap-1">
                        {email}
                        <button
                          type="button"
                          onClick={() => handleRemoveEmail(email)}
                          className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Input pour ajouter des emails */}
                <div className="flex gap-2">
                  <Input
                    placeholder={t("InviteMemberDialog.emailPlaceholder")}
                    value={currentEmail}
                    onChange={(e) => setCurrentEmail(e.target.value)}
                    onKeyPress={handleKeyPress}
                    type="email"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddEmail}
                    disabled={!currentEmail.trim() || !isValidEmail(currentEmail.trim())}
                  >
                    {t("InviteMemberDialog.addEmail")}
                  </Button>
                </div>

                <FormField
                  control={form.control}
                  name="emails"
                  render={() => (
                    <FormItem>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Role selection */}
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("InviteMemberDialog.role")}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("InviteMemberDialog.selectRole")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={inviteMutation.isPending || emailList.length === 0}
              >
                {inviteMutation.isPending
                  ? t("InviteMemberDialog.sending")
                  : t("InviteMemberDialog.sendInvitations")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}