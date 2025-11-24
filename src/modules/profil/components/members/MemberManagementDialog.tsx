import { useState } from "react";
import { useT } from "@/hooks/useT";
import { useEntityMembers } from "../../hooks/useMembersQuery";
import {
  useAcceptMemberRequest,
  useRejectMemberRequest,
  usePromoteMember,
  useDemoteMember,
  useRemoveMember,
} from "../../hooks/useMemberMutations";
import { isOrganization, isProject, isEvent } from "@/lib/getTypedEntity";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Settings,
  MoreVertical,
  Check,
  X,
  Crown,
  User,
  Trash2,
  Search,
  ShieldOff,
} from "lucide-react";

interface MemberManagementDialogProps {
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

export function MemberManagementDialog({ entity, open, onOpenChange }: MemberManagementDialogProps) {
  const t = useT("modules/profil");
  const [activeTab, setActiveTab] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    open: false,
    title: "",
    description: "",
    action: () => {},
  });

  // Queries
  const allMembers = useEntityMembers(entity, {}, {});
  const pendingMembers = useEntityMembers(entity, { toBeValidated: true }, {});

  // Mutations
  const acceptMutation = useAcceptMemberRequest(entity);
  const rejectMutation = useRejectMemberRequest(entity);
  const promoteMutation = usePromoteMember(entity);
  const demoteMutation = useDemoteMember(entity);
  const removeMutation = useRemoveMember(entity);

  if (!entity) return null;

  const getEntityLabels = () => {
    if (isOrganization(entity)) {
      return {
        title: t("MemberManagementDialog.organization.title"),
        members: t("ProfileMembers.organization.members"),
        pending: t("ProfileMembers.organization.pending"),
        member: t("ProfileMembers.organization.member"),
        admin: t("ProfileMembers.organization.admin"),
      };
    } else if (isProject(entity)) {
      return {
        title: t("MemberManagementDialog.project.title"),
        members: t("ProfileMembers.project.contributors"),
        pending: t("ProfileMembers.project.pending"),
        member: t("ProfileMembers.project.contributor"),
        admin: t("ProfileMembers.project.admin"),
      };
    } else if (isEvent(entity)) {
      return {
        title: t("MemberManagementDialog.event.title"),
        members: t("ProfileMembers.event.participants"),
        pending: t("ProfileMembers.event.pending"),
        member: t("ProfileMembers.event.participant"),
        admin: t("ProfileMembers.event.author"),
      };
    }
    return {
      title: t("MemberManagementDialog.title"),
      members: t("ProfileMembers.members"),
      pending: t("ProfileMembers.pending"),
      member: t("ProfileMembers.member"),
      admin: t("ProfileMembers.admin"),
    };
  };

  const labels = getEntityLabels();

  const showConfirmation = (config: Omit<ConfirmationState, "open">) => {
    setConfirmation({ ...config, open: true });
  };

  const handleAcceptMember = (memberId: string, memberName: string) => {
    showConfirmation({
      title: t("MemberManagementDialog.acceptDialog.title"),
      description: t("MemberManagementDialog.acceptDialog.description").replace("{{name}}", memberName),
      action: () => acceptMutation.mutate({ memberId }),
    });
  };

  const handleRejectMember = (memberId: string, memberName: string) => {
    showConfirmation({
      title: t("MemberManagementDialog.rejectDialog.title"),
      description: t("MemberManagementDialog.rejectDialog.description").replace("{{name}}", memberName),
      action: () => rejectMutation.mutate({ memberId }),
      isDestructive: true,
    });
  };

  const handlePromoteMember = (memberId: string, memberName: string) => {
    showConfirmation({
      title: t("MemberManagementDialog.promoteDialog.title"),
      description: t("MemberManagementDialog.promoteDialog.description").replace("{{name}}", memberName),
      action: () => promoteMutation.mutate({ memberId }),
    });
  };

  const handleDemoteMember = (memberId: string, memberName: string) => {
    showConfirmation({
      title: t("MemberManagementDialog.demoteDialog.title"),
      description: t("MemberManagementDialog.demoteDialog.description").replace("{{name}}", memberName),
      action: () => demoteMutation.mutate({ memberId }),
    });
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    showConfirmation({
      title: t("MemberManagementDialog.removeDialog.title"),
      description: t("MemberManagementDialog.removeDialog.description").replace("{{name}}", memberName),
      action: () => removeMutation.mutate({ memberId }),
      isDestructive: true,
    });
  };

  const filterMembers = (members: any[]) => {
    if (!searchTerm) return members;
    return members.filter(member =>
      member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const renderMemberActions = (member: any, isPending = false) => {
    if (isPending) {
      return (
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="default"
            onClick={() => handleAcceptMember(member.id, member.name)}
            disabled={acceptMutation.isPending}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleRejectMember(member.id, member.name)}
            disabled={rejectMutation.isPending}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!member.isAdmin && !isEvent(entity) && (
            <DropdownMenuItem onClick={() => handlePromoteMember(member.id, member.name)}>
              <Crown className="h-4 w-4 mr-2" />
              {t("MemberManagementDialog.promote")}
            </DropdownMenuItem>
          )}
          {member.isAdmin && !isEvent(entity) && (
            <DropdownMenuItem onClick={() => handleDemoteMember(member.id, member.name)}>
              <ShieldOff className="h-4 w-4 mr-2" />
              {t("MemberManagementDialog.demote")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => handleRemoveMember(member.id, member.name)}
            className="text-red-600"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t("MemberManagementDialog.remove")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const renderMemberList = (members: any[], isLoading: boolean, isPending = false) => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 border rounded-lg animate-pulse">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-gray-200 rounded-full" />
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-32" />
                  <div className="h-3 bg-gray-200 rounded w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    const filteredMembers = filterMembers(members);

    if (filteredMembers.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{isPending ? t("MemberManagementDialog.noPending") : t("MemberManagementDialog.noMembers")}</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {filteredMembers.map((member: any) => (
          <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={member.image} alt={member.name} />
                <AvatarFallback>{member.name?.[0] || "?"}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{member.name}</p>
                <p className="text-sm text-gray-500">{member.email}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {!isPending && member.roles?.map((role: string) => (
                <Badge key={role} variant={role === "admin" ? "default" : "outline"}>
                  {role}
                </Badge>
              ))}
              {renderMemberActions(member, isPending)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>{labels.title}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder={t("MemberManagementDialog.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="pending">
                  {labels.pending} ({pendingMembers.members?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="all">
                  {labels.members} ({allMembers.members?.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="mt-4 max-h-96 overflow-y-auto">
                {renderMemberList(pendingMembers.members || [], pendingMembers.isLoading, true)}
              </TabsContent>

              <TabsContent value="all" className="mt-4 max-h-96 overflow-y-auto">
                {renderMemberList(allMembers.members || [], allMembers.isLoading, false)}
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

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
    </>
  );
}