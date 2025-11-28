import { useState } from "react";
import { toast } from "sonner";
import { useT } from "@/hooks/useT";
import { useSearchUsers } from "@/hooks/useSearchUsers";
import { isOrganization, isProject, isEvent } from "@/lib/getTypedEntity";
import type { EntityTypes, User } from "@communecter/cocolight-api-client";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserPlus, X, Search, Loader2, Mail, Crown, ShieldOff, Trash2, MoreVertical, Check, User as UserIcon, Clock } from "lucide-react";


interface InviteMemberDialogProps {
  entity: EntityTypes | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ConfirmationState {
  open: boolean;
  title: string;
  description: string;
  action: () => void;
  isDestructive?: boolean;
}

interface UserAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  variant: "default" | "outline" | "destructive" | "secondary";
  onClick: () => void;
  disabled?: boolean;
  requiresConfirmation?: boolean;
}

export function InviteMemberDialog({ entity, open, onOpenChange }: InviteMemberDialogProps) {
  const t = useT("modules/profil");
  const [activeTab, setActiveTab] = useState("users");
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    open: false,
    title: "",
    description: "",
    action: () => {},
  });

  // Recherche d'utilisateurs en temps réel via l'API
  const { data: users = [], isLoading } = useSearchUsers(searchTerm, searchTerm.length >= 2, entity);


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

  const showConfirmation = (config: Omit<ConfirmationState, "open">) => {
    setConfirmation({ ...config, open: true });
  };

  // Fonction qui analyse l'état d'un utilisateur et retourne les actions possibles
  const getUserActionButtons = (user: User): UserAction[] => {
    const actions: UserAction[] = [];
    const userName = user.serverData?.name || "Unknown";

    if (!entity) return actions;

    // Actions spécifiques selon le type d'entité
    if (isOrganization(entity)) {
      // Admin d'organisation
      if (user.isAdmin?.()) {
        actions.push({
          id: "demote",
          label: t("InviteMemberDialog.demote"),
          icon: <ShieldOff className="w-3 h-3" />,
          variant: "outline",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.demoteDialog.title"),
            description: t("InviteMemberDialog.demoteDialog.description", undefined, { name: userName }),
            action: async () => {
              try {
                if (user.demoteFromAdmin) {
                  await user.demoteFromAdmin();
                  toast.success(t("toast.members.demoteSuccess", undefined, { name: userName }));
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
                toast.error(t("toast.members.demoteError", undefined, { name: userName }), {
                  description: errorMessage,
                });
              }
            }
          }),
          requiresConfirmation: true
        });

        actions.push({
          id: "remove",
          label: t("InviteMemberDialog.remove"),
          icon: <Trash2 className="w-3 h-3" />,
          variant: "destructive",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.removeDialog.title"),
            description: t("InviteMemberDialog.removeDialog.description", undefined, { name: userName }),
            action: async () => {
              try {
                if (user.removeFromParent) {
                  await user.removeFromParent();
                  toast.success(t("toast.members.removeSuccess", undefined, { name: userName }));
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
                toast.error(t("toast.members.removeError", undefined, { name: userName }), {
                  description: errorMessage,
                });
              }
            },
            isDestructive: true
          }),
          requiresConfirmation: true
        });

        return actions;
      }

      // Membre d'organisation
      if (user.isMember?.()) {
        actions.push({
          id: "promote",
          label: t("InviteMemberDialog.promoteToAdmin"),
          icon: <Crown className="w-3 h-3" />,
          variant: "outline",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.promoteDialog.title"),
            description: t("InviteMemberDialog.promoteDialog.description", undefined, { name: userName }),
            action: async () => {
              try {
                if (user.promoteToAdmin) {
                  await user.promoteToAdmin();
                  toast.success(t("toast.members.promoteSuccess", undefined, { name: userName }));
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
                toast.error(t("toast.members.promoteError", undefined, { name: userName }), {
                  description: errorMessage,
                });
              }
            }
          }),
          requiresConfirmation: true
        });

        actions.push({
          id: "remove",
          label: t("InviteMemberDialog.remove"),
          icon: <Trash2 className="w-3 h-3" />,
          variant: "destructive",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.removeDialog.title"),
            description: t("InviteMemberDialog.removeDialog.description", undefined, { name: userName }),
            action: async () => {
              try {
                if (user.removeFromParent) {
                  await user.removeFromParent();
                  toast.success(t("toast.members.removeSuccess", undefined, { name: userName }));
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
                toast.error(t("toast.members.removeError", undefined, { name: userName }), {
                  description: errorMessage,
                });
              }
            },
            isDestructive: true
          }),
          requiresConfirmation: true
        });

        return actions;
      }

      // États d'invitation/validation pour organisations
      if (user.isInvitingAdmin?.()) {
        return [{
          id: "inviting-admin",
          label: t("InviteMemberDialog.adminInvitationSent"),
          icon: <Crown className="w-3 h-3" />,
          variant: "secondary",
          onClick: () => {},
          disabled: true
        }];
      }

      if (user.isAdminPending?.()) {
        actions.push({
          id: "validate-admin",
          label: t("InviteMemberDialog.validateAdmin"),
          icon: <Crown className="w-3 h-3" />,
          variant: "default",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.validateAdminDialog.title"),
            description: t("InviteMemberDialog.validateAdminDialog.description", undefined, { name: userName }),
            action: async () => {
              try {
                if (user.validateAdminRequest) {
                  await user.validateAdminRequest();
                  toast.success(t("toast.members.validateAdminSuccess", undefined, { name: userName }));
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
                toast.error(t("toast.members.validateAdminError", undefined, { name: userName }), {
                  description: errorMessage,
                });
              }
            }
          }),
          requiresConfirmation: true
        });

        return actions;
      }

      if (user.isInviting?.()) {
        return [{
          id: "inviting",
          label: t("InviteMemberDialog.invited"),
          icon: <Mail className="w-3 h-3" />,
          variant: "secondary",
          onClick: () => {},
          disabled: true
        }];
      }

      if (user.isToBeValidated?.()) {
        actions.push({
          id: "validate",
          label: t("InviteMemberDialog.validate"),
          icon: <Check className="w-3 h-3" />,
          variant: "default",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.validateDialog.title"),
            description: t("InviteMemberDialog.validateDialog.description", undefined, { name: userName }),
            action: async () => {
              try {
                if (user.validateMemberRequest) {
                  await user.validateMemberRequest();
                  toast.success(t("toast.members.validateSuccess", undefined, { name: userName }));
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
                toast.error(t("toast.members.validateError", undefined, { name: userName }), {
                  description: errorMessage,
                });
              }
            }
          }),
          requiresConfirmation: true
        });

        actions.push({
          id: "reject",
          label: t("InviteMemberDialog.reject"),
          icon: <X className="w-3 h-3" />,
          variant: "destructive",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.rejectDialog.title"),
            description: t("InviteMemberDialog.rejectDialog.description", undefined, { name: userName }),
            action: async () => {
              try {
                if (user.removeFromParent) {
                  await user.removeFromParent();
                  toast.success(t("toast.members.removeSuccess", undefined, { name: userName }));
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
                toast.error(t("toast.members.removeError", undefined, { name: userName }), {
                  description: errorMessage,
                });
              }
            },
            isDestructive: true
          }),
          requiresConfirmation: true
        });

        return actions;
      }
    } else if (isProject(entity)) {
      // Admin de projet
      if (user.isAdmin?.()) {
        actions.push({
          id: "demote",
          label: t("InviteMemberDialog.demote"),
          icon: <ShieldOff className="w-3 h-3" />,
          variant: "outline",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.demoteDialog.title"),
            description: t("InviteMemberDialog.demoteDialog.description", undefined, { name: userName }),
            action: async () => {
              try {
                if (user.demoteFromAdmin) {
                  await user.demoteFromAdmin();
                  toast.success(t("toast.members.demoteSuccess", undefined, { name: userName }));
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
                toast.error(t("toast.members.demoteError", undefined, { name: userName }), {
                  description: errorMessage,
                });
              }
            }
          }),
          requiresConfirmation: true
        });

        actions.push({
          id: "remove",
          label: t("InviteMemberDialog.remove"),
          icon: <Trash2 className="w-3 h-3" />,
          variant: "destructive",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.removeDialog.title"),
            description: t("InviteMemberDialog.removeDialog.description", undefined, { name: userName }),
            action: async () => {
              try {
                if (user.removeFromParent) {
                  await user.removeFromParent();
                  toast.success(t("toast.members.removeSuccess", undefined, { name: userName }));
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
                toast.error(t("toast.members.removeError", undefined, { name: userName }), {
                  description: errorMessage,
                });
              }
            },
            isDestructive: true
          }),
          requiresConfirmation: true
        });

        return actions;
      }

      // Contributeur de projet
      if (user.isContributor?.()) {
        actions.push({
          id: "promote",
          label: t("InviteMemberDialog.promoteToAdmin"),
          icon: <Crown className="w-3 h-3" />,
          variant: "outline",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.promoteDialog.title"),
            description: t("InviteMemberDialog.promoteDialog.description", undefined, { name: userName }),
            action: async () => {
              try {
                if (user.promoteToAdmin) {
                  await user.promoteToAdmin();
                  toast.success(t("toast.members.promoteSuccess", undefined, { name: userName }));
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
                toast.error(t("toast.members.promoteError", undefined, { name: userName }), {
                  description: errorMessage,
                });
              }
            }
          }),
          requiresConfirmation: true
        });

        actions.push({
          id: "remove",
          label: t("InviteMemberDialog.remove"),
          icon: <Trash2 className="w-3 h-3" />,
          variant: "destructive",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.removeDialog.title"),
            description: t("InviteMemberDialog.removeDialog.description", undefined, { name: userName }),
            action: async () => {
              try {
                if (user.removeFromParent) {
                  await user.removeFromParent();
                  toast.success(t("toast.members.removeSuccess", undefined, { name: userName }));
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
                toast.error(t("toast.members.removeError", undefined, { name: userName }), {
                  description: errorMessage,
                });
              }
            },
            isDestructive: true
          }),
          requiresConfirmation: true
        });

        return actions;
      }

      // États d'invitation/validation pour projets
      if (user.isInvitingAdmin?.()) {
        return [{
          id: "inviting-admin",
          label: t("InviteMemberDialog.adminInvitationSent"),
          icon: <Crown className="w-3 h-3" />,
          variant: "secondary",
          onClick: () => {},
          disabled: true
        }];
      }

      if (user.isAdminPending?.()) {
        actions.push({
          id: "validate-admin",
          label: t("InviteMemberDialog.validateAdmin"),
          icon: <Crown className="w-3 h-3" />,
          variant: "default",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.validateAdminDialog.title"),
            description: t("InviteMemberDialog.validateAdminDialog.description", undefined, { name: userName }),
            action: async () => {
              try {
                if (user.validateAdminRequest) {
                  await user.validateAdminRequest();
                  toast.success(t("toast.members.validateAdminSuccess", undefined, { name: userName }));
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
                toast.error(t("toast.members.validateAdminError", undefined, { name: userName }), {
                  description: errorMessage,
                });
              }
            }
          }),
          requiresConfirmation: true
        });

        return actions;
      }

      if (user.isInviting?.()) {
        return [{
          id: "inviting",
          label: t("InviteMemberDialog.invited"),
          icon: <Mail className="w-3 h-3" />,
          variant: "secondary",
          onClick: () => {},
          disabled: true
        }];
      }

      if (user.isToBeValidated?.()) {
        actions.push({
          id: "validate",
          label: t("InviteMemberDialog.validate"),
          icon: <Check className="w-3 h-3" />,
          variant: "default",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.validateDialog.title"),
            description: t("InviteMemberDialog.validateDialog.description", undefined, { name: userName }),
            action: async () => {
              try {
                if (user.validateMemberRequest) {
                  await user.validateMemberRequest();
                  toast.success(t("toast.members.validateSuccess", undefined, { name: userName }));
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
                toast.error(t("toast.members.validateError", undefined, { name: userName }), {
                  description: errorMessage,
                });
              }
            }
          }),
          requiresConfirmation: true
        });

        actions.push({
          id: "reject",
          label: t("InviteMemberDialog.reject"),
          icon: <X className="w-3 h-3" />,
          variant: "destructive",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.rejectDialog.title"),
            description: t("InviteMemberDialog.rejectDialog.description", undefined, { name: userName }),
            action: async () => {
              try {
                if (user.removeFromParent) {
                  await user.removeFromParent();
                  toast.success(t("toast.members.removeSuccess", undefined, { name: userName }));
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
                toast.error(t("toast.members.removeError", undefined, { name: userName }), {
                  description: errorMessage,
                });
              }
            },
            isDestructive: true
          }),
          requiresConfirmation: true
        });

        return actions;
      }
    } else if (isEvent(entity)) {
      // Participant d'événement
      if (user.isAttendee?.()) {
        actions.push({
          id: "remove",
          label: t("InviteMemberDialog.remove"),
          icon: <Trash2 className="w-3 h-3" />,
          variant: "destructive",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.removeDialog.title"),
            description: t("InviteMemberDialog.removeDialog.description", undefined, { name: userName }),
            action: async () => {
              try {
                if (user.removeFromParent) {
                  await user.removeFromParent();
                  toast.success(t("toast.members.removeSuccess", undefined, { name: userName }));
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
                toast.error(t("toast.members.removeError", undefined, { name: userName }), {
                  description: errorMessage,
                });
              }
            },
            isDestructive: true
          }),
          requiresConfirmation: true
        });

        return actions;
      }

      // États d'invitation/validation pour événements
      if (user.isInviting?.()) {
        return [{
          id: "inviting",
          label: t("InviteMemberDialog.invited"),
          icon: <Mail className="w-3 h-3" />,
          variant: "secondary",
          onClick: () => {},
          disabled: true
        }];
      }

      if (user.isToBeValidated?.()) {
        actions.push({
          id: "validate",
          label: t("InviteMemberDialog.validate"),
          icon: <Check className="w-3 h-3" />,
          variant: "default",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.validateDialog.title"),
            description: t("InviteMemberDialog.validateDialog.description", undefined, { name: userName }),
            action: async () => {
              try {
                if (user.validateMemberRequest) {
                  await user.validateMemberRequest();
                  toast.success(t("toast.members.validateSuccess", undefined, { name: userName }));
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
                toast.error(t("toast.members.validateError", undefined, { name: userName }), {
                  description: errorMessage,
                });
              }
            }
          }),
          requiresConfirmation: true
        });

        actions.push({
          id: "reject",
          label: t("InviteMemberDialog.reject"),
          icon: <X className="w-3 h-3" />,
          variant: "destructive",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.rejectDialog.title"),
            description: t("InviteMemberDialog.rejectDialog.description", undefined, { name: userName }),
            action: async () => {
              try {
                if (user.removeFromParent) {
                  await user.removeFromParent();
                  toast.success(t("toast.members.removeSuccess", undefined, { name: userName }));
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
                toast.error(t("toast.members.removeError", undefined, { name: userName }), {
                  description: errorMessage,
                });
              }
            },
            isDestructive: true
          }),
          requiresConfirmation: true
        });

        return actions;
      }
    }

    // Utilisateur normal - actions d'invitation (dernier recours)
    if (isOrganization(entity)) {
      actions.push({
        id: "invite-member",
        label: t("InviteMemberDialog.inviteMember"),
        icon: <UserPlus className="w-3 h-3" />,
        variant: "default",
        onClick: async () => {
          try {
            if (user.sendRequestToJoinParent) {
              await user.sendRequestToJoinParent();
              toast.success(t("toast.members.inviteSuccess", undefined, { name: userName }));
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
            toast.error(t("toast.members.inviteError", undefined, { name: userName }), {
              description: errorMessage,
            });
          }
        }
      });

      actions.push({
        id: "invite-admin",
        label: t("InviteMemberDialog.inviteAdmin"),
        icon: <Crown className="w-3 h-3" />,
        variant: "outline",
        onClick: async () => {
          try {
            if (user.sendRequestToJoinParent) {
              await user.sendRequestToJoinParent({ admin: true });
              toast.success(t("toast.members.inviteAdminSuccess", undefined, { name: userName }));
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
            toast.error(t("toast.members.inviteAdminError", undefined, { name: userName }), {
              description: errorMessage,
            });
          }
        }
      });
    } else if (isProject(entity)) {
      actions.push({
        id: "invite-contributor",
        label: t("InviteMemberDialog.inviteContributor"),
        icon: <UserPlus className="w-3 h-3" />,
        variant: "default",
        onClick: async () => {
          try {
            if (user.sendRequestToJoinParent) {
              await user.sendRequestToJoinParent();
              toast.success(t("toast.members.inviteSuccess", undefined, { name: userName }));
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
            toast.error(t("toast.members.inviteError", undefined, { name: userName }), {
              description: errorMessage,
            });
          }
        }
      });

      actions.push({
        id: "invite-admin",
        label: t("InviteMemberDialog.inviteAdmin"),
        icon: <Crown className="w-3 h-3" />,
        variant: "outline",
        onClick: async () => {
          try {
            if (user.sendRequestToJoinParent) {
              await user.sendRequestToJoinParent({ admin: true });
              toast.success(t("toast.members.inviteAdminSuccess", undefined, { name: userName }));
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
            toast.error(t("toast.members.inviteAdminError", undefined, { name: userName }), {
              description: errorMessage,
            });
          }
        }
      });
    } else if (isEvent(entity)) {
      actions.push({
        id: "invite-participant",
        label: t("InviteMemberDialog.inviteParticipant"),
        icon: <UserPlus className="w-3 h-3" />,
        variant: "default",
        onClick: async () => {
          try {
            if (user.sendRequestToJoinParent) {
              await user.sendRequestToJoinParent();
              toast.success(t("toast.members.inviteSuccess", undefined, { name: userName }));
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
            toast.error(t("toast.members.inviteError", undefined, { name: userName }), {
              description: errorMessage,
            });
          }
        }
      });
    }

    return actions;
  };

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
                className={action.variant === "destructive" ? "text-red-600" : ""}
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

  // Fonction pour obtenir le badge de statut d'un utilisateur
  const getUserStatusBadge = (user: User) => {
    if (!entity) return null;
    // États spécifiques selon le type d'entité
    if (isOrganization(entity)) {
      if (user.isAdmin?.()) {
        return (
          <Badge variant="default">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.admin")}</span>
            <Crown className="sm:hidden w-3 h-3" />
          </Badge>
        );
      }
      if (user.isMember?.()) {
        return (
          <Badge variant="secondary">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.member")}</span>
            <UserIcon className="sm:hidden w-3 h-3" />
          </Badge>
        );
      }
      if (user.isInvitingAdmin?.()) {
        return (
          <Badge variant="outline">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.adminInvitationPending")}</span>
            <Crown className="sm:hidden w-3 h-3 animate-pulse" />
          </Badge>
        );
      }
      if (user.isAdminPending?.()) {
        return (
          <Badge variant="outline">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.adminRequestPending")}</span>
            <Clock className="sm:hidden w-3 h-3" />
          </Badge>
        );
      }
      if (user.isInviting?.()) {
        return (
          <Badge variant="outline">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.invitationPending")}</span>
            <Mail className="sm:hidden w-3 h-3 animate-pulse" />
          </Badge>
        );
      }
      if (user.isToBeValidated?.()) {
        return (
          <Badge variant="outline">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.validationPending")}</span>
            <Clock className="sm:hidden w-3 h-3" />
          </Badge>
        );
      }
    } else if (isProject(entity)) {
      if (user.isAdmin?.()) {
        return (
          <Badge variant="default">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.admin")}</span>
            <Crown className="sm:hidden w-3 h-3" />
          </Badge>
        );
      }
      if (user.isContributor?.()) {
        return (
          <Badge variant="secondary">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.contributor")}</span>
            <UserIcon className="sm:hidden w-3 h-3" />
          </Badge>
        );
      }
      if (user.isInvitingAdmin?.()) {
        return (
          <Badge variant="outline">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.adminInvitationPending")}</span>
            <Crown className="sm:hidden w-3 h-3 animate-pulse" />
          </Badge>
        );
      }
      if (user.isAdminPending?.()) {
        return (
          <Badge variant="outline">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.adminRequestPending")}</span>
            <Clock className="sm:hidden w-3 h-3" />
          </Badge>
        );
      }
      if (user.isInviting?.()) {
        return (
          <Badge variant="outline">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.invitationPending")}</span>
            <Mail className="sm:hidden w-3 h-3 animate-pulse" />
          </Badge>
        );
      }
      if (user.isToBeValidated?.()) {
        return (
          <Badge variant="outline">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.validationPending")}</span>
            <Clock className="sm:hidden w-3 h-3" />
          </Badge>
        );
      }
    } else if (isEvent(entity)) {
      if (user.isAttendee?.()) {
        return (
          <Badge variant="secondary">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.participant")}</span>
            <UserIcon className="sm:hidden w-3 h-3" />
          </Badge>
        );
      }
      if (user.isInviting?.()) {
        return (
          <Badge variant="outline">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.invitationPending")}</span>
            <Mail className="sm:hidden w-3 h-3 animate-pulse" />
          </Badge>
        );
      }
      if (user.isToBeValidated?.()) {
        return (
          <Badge variant="outline">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.validationPending")}</span>
            <Clock className="sm:hidden w-3 h-3" />
          </Badge>
        );
      }
    }

    return null;
  };

  const handleClose = () => {
    setSearchTerm("");
    setActiveTab("users");
    setConfirmation({
      open: false,
      title: "",
      description: "",
      action: () => {},
    });
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
          <p className="text-sm text-gray-600">
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
                      <Search className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-muted-foreground text-sm">
                        {t("InviteMemberDialog.startTyping")}
                      </p>
                    </div>
                  ) : searchTerm.length < 2 ? (
                    <div className="text-center py-8">
                      <Search className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-muted-foreground text-sm">
                        {t("InviteMemberDialog.minimumChars")}
                      </p>
                    </div>
                  ) : isLoading ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-8 h-8 mx-auto text-teal-600 animate-spin mb-4" />
                      <p className="text-muted-foreground text-sm">
                        {t("InviteMemberDialog.searching")}
                      </p>
                    </div>
                  ) : users.length === 0 ? (
                    <div className="text-center py-8">
                      <Search className="w-12 h-12 mx-auto text-gray-400 mb-4" />
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
                            {getUserStatusBadge(user)}
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
              <div className="text-center py-8">
                <Mail className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-foreground font-medium mb-2">
                  {t("InviteMemberDialog.emailInvitationsComingSoon")}
                </p>
                <p className="text-muted-foreground text-sm">
                  {t("InviteMemberDialog.useSearchForNow")}
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmation.open} onOpenChange={(open) => setConfirmation(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmation.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmation.action}
              className={confirmation.isDestructive ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}