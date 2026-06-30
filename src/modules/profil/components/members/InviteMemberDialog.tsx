import { useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useT } from "@/hooks/useT";
import { useSearchUsers } from "@/hooks/useSearchUsers";
import type { EntityTypes, User } from "@communecter/cocolight-api-client";
import { useEntityLabels } from "../../hooks/useEntityLabels";
import { useConfirmationDialog } from "../../hooks/useConfirmationDialog";
import { useAdminActions, useInviteByEmail, canInviteByEmail } from "../../actions";
import { useUserStatusBadge } from "../../hooks/useUserStatusBadge";
import { ConfirmationDialog } from "./ConfirmationDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagsInput } from "@/components/form/TagsInput";
import { toast } from "sonner";
import { UserPlus, Search, Loader2, Mail, MoreVertical } from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


interface InviteMemberDialogProps {
  entity: EntityTypes | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteMemberDialog({ entity, open, onOpenChange }: InviteMemberDialogProps) {
  const t = useT("modules/profil");
  const [activeTab, setActiveTab] = useState("users");
  const [searchTerm, setSearchTerm] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  // Inviter comme membre (membre/contributeur/participant selon le type) ou admin → flag isAdmin du lien.
  const [inviteAs, setInviteAs] = useState<"member" | "admin">("member");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const { confirmation, showConfirmation, hideConfirmation, executeAction } = useConfirmationDialog();
  const { getUserActionButtons } = useAdminActions(entity, showConfirmation);
  const { getUserStatusBadge } = useUserStatusBadge();

  // Invitation par email (personnes sans compte) — dispo pour organizations/projects uniquement.
  const inviteByEmail = useInviteByEmail(entity);
  const emailEnabled = canInviteByEmail(entity);

  const handleSendInvites = () => {
    const invalid = emails.filter((e) => !EMAIL_RE.test(e));
    if (invalid.length > 0) {
      toast.error(t("InviteMemberDialog.invalidEmailsError", undefined, { emails: invalid.join(", ") }));
      return;
    }
    if (emails.length === 0) {
      toast.error(t("InviteMemberDialog.noEmailsError"));
      return;
    }
    // name = email (fallback du front legacy quand seule l'adresse est fournie).
    // clé `mail` (pas `email`) : le legacy lit $value["mail"] (contrat lib aligné).
    // isAdmin: "admin" => invité comme administrateur ; "" => membre/contributeur/participant.
    const isAdmin = inviteAs === "admin" ? "admin" : "";
    inviteByEmail.mutate(
      emails.map((email) => ({ name: email, mail: email, isAdmin })),
      {
        onSuccess: () => {
          setEmails([]);
          setInviteAs("member");
        },
      },
    );
  };

  // Recherche d'utilisateurs en temps réel via l'API
  const { data: users = [], isLoading } = useSearchUsers(debouncedSearch, debouncedSearch.length >= 2, entity);

  // Labels spécifiques à l'entité
  const labels = useEntityLabels(entity);


  // Composant pour afficher les actions d'un utilisateur
  const UserActionButtons = ({ user }: { user: User }) => {
    const actions = getUserActionButtons(user);

    if (actions.length === 0) return null;

    // Si une seule action, afficher le bouton directement
    if (actions.length === 1) {
      const action = actions[0];
      return (
        <Button
          size="sm"
          variant={action.variant}
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.icon}
          <span className="hidden sm:inline ml-1">{action.label}</span>
        </Button>
      );
    }

    // Si plusieurs actions, utiliser un dropdown
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <MoreVertical className="w-4 h-4" />
            <span className="hidden sm:inline">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.map((action, index) => (
            <div key={action.id}>
              <DropdownMenuItem
                onClick={action.onClick}
                disabled={action.disabled}
                className={action.variant === "destructive" ? "text-destructive" : ""}
              >
                {action.icon}
                <span className="ml-2">{action.label}</span>
              </DropdownMenuItem>
              {index < actions.length - 1 && action.variant === "destructive" && (
                <DropdownMenuSeparator />
              )}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };


  const handleClose = () => {
    setSearchTerm("");
    setEmails([]);
    setInviteAs("member");
    setActiveTab("users");
    hideConfirmation();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <UserPlus className="h-5 w-5" />
            <span>{labels.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {labels.description}
          </p>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">{t("InviteMemberDialog.tabs.searchUsers")}</span>
              </TabsTrigger>
              <TabsTrigger value="emails" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span className="hidden sm:inline">{t("InviteMemberDialog.tabs.inviteByEmail")}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-4 mt-6">
              {/* Recherche d'utilisateurs */}
              <div className="space-y-3">
                <Label>
                  {t("InviteMemberDialog.searchUsers")}
                </Label>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder={t("InviteMemberDialog.searchPlaceholder")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>


                {/* Résultats de recherche */}
                <div className="max-h-60 overflow-y-auto">
                  {searchTerm === "" ? (
                    <div className="text-center py-8">
                      <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground text-sm">
                        {t("InviteMemberDialog.startTyping")}
                      </p>
                    </div>
                  ) : searchTerm.length < 2 ? (
                    <div className="text-center py-8">
                      <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground text-sm">
                        {t("InviteMemberDialog.minimumChars")}
                      </p>
                    </div>
                  ) : isLoading ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin mb-4" />
                      <p className="text-muted-foreground text-sm">
                        {t("InviteMemberDialog.searching")}
                      </p>
                    </div>
                  ) : users.length === 0 ? (
                    <div className="text-center py-8">
                      <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-foreground font-medium mb-2">
                        {t("InviteMemberDialog.noUsersFound")}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {t("InviteMemberDialog.tryDifferentSearch")}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {users.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-3 hover:bg-muted rounded-lg border border-border"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={user.serverData?.profilThumbImageUrl || undefined} />
                              <AvatarFallback>
                                {user.serverData?.name?.charAt(0) || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <h4 className="font-medium text-foreground text-sm">
                                {user.serverData?.name || "Unknown"}
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                {user.serverData?.slug && `@${user.serverData.slug}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getUserStatusBadge(user, entity)}
                            <UserActionButtons user={user} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="emails" className="space-y-4 mt-6">
              {emailEnabled ? (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <Label>{t("InviteMemberDialog.emailAddresses")}</Label>
                    <TagsInput
                      tags={emails}
                      onTagsChange={setEmails}
                      searchable={false}
                      maxTags={50}
                      texts={{ placeholder: t("InviteMemberDialog.emailPlaceholder") }}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("InviteMemberDialog.emailHint")}
                    </p>
                  </div>
                  <div className="space-y-3">
                    <Label>{t("InviteMemberDialog.inviteAs")}</Label>
                    <Select value={inviteAs} onValueChange={(v) => setInviteAs(v as "member" | "admin")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">{labels.member}</SelectItem>
                        <SelectItem value="admin">{labels.admin}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-foreground font-medium mb-2">
                    {t("InviteMemberDialog.emailInvitationsComingSoon")}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {t("InviteMemberDialog.emailNotAvailableForEvents")}
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              {t("common.cancel")}
            </Button>
            {activeTab === "emails" && emailEnabled && (
              <Button
                onClick={handleSendInvites}
                disabled={emails.length === 0 || inviteByEmail.isPending}
              >
                {inviteByEmail.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("InviteMemberDialog.sending")}
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    {t("InviteMemberDialog.sendInvitations")}
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        confirmation={confirmation}
        onOpenChange={hideConfirmation}
        onConfirm={executeAction}
      />
    </Dialog>
  );
}