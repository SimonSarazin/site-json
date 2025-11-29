import { useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { UserPlus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { User } from "@communecter/cocolight-api-client";
import { useT } from "@/hooks/useT";
import { useSendFriendRequest } from "../../hooks/useFriendMutations";
import { useCocolight } from "@/hooks/useCocolight";
import { useSearchUsers } from "@/hooks/useSearchUsers";
import { LoadingState, EmptyState, UserListItem } from "../shared";

export function FriendRequestDialog() {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const { me } = useCocolight();
  const t = useT("modules/profil");

  const sendFriendRequestMutation = useSendFriendRequest(me);

  // Recherche d'utilisateurs en temps réel via l'API
  const { data: users = [], isLoading } = useSearchUsers(
    debouncedSearch,
    debouncedSearch.length >= 2
  );

  const handleSendRequest = (user: User) => {
    sendFriendRequestMutation.mutate(
      { user },
      {
        onSuccess: () => {
          setOpen(false);
          setSearchTerm("");
        },
      }
    );
  };

  const renderContent = () => {
    if (searchTerm === "") {
      return (
        <EmptyState
          icon={Search}
          title={t("FriendRequestDialog.startTyping")}
          variant="compact"
        />
      );
    }

    if (searchTerm.length < 2) {
      return (
        <EmptyState
          icon={Search}
          title={t("FriendRequestDialog.minimumChars")}
          variant="compact"
        />
      );
    }

    if (isLoading) {
      return <LoadingState variant="spinner" message={t("FriendRequestDialog.searching")} />;
    }

    if (users.length === 0) {
      return (
        <EmptyState
          icon={Search}
          title={t("FriendRequestDialog.noUsersFound")}
          description={t("FriendRequestDialog.tryDifferentSearch")}
          variant="compact"
        />
      );
    }

    return (
      <div className="space-y-2">
        {users.map((user) => (
          <UserListItem
            key={user.serverData.id}
            user={user}
            subtitle={user.serverData.slug ? `@${user.serverData.slug}` : undefined}
            variant="card"
            actions={
              <Button
                size="sm"
                onClick={() => handleSendRequest(user)}
                disabled={sendFriendRequestMutation.isPending}
                className="bg-teal-600 hover:bg-teal-700"
              >
                <UserPlus className="w-3 h-3 mr-1" />
                {t("FriendRequestDialog.sendRequest")}
              </Button>
            }
          />
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-teal-600 hover:bg-teal-700">
          <UserPlus className="w-4 h-4 mr-2" />
          {t("SocialTab.addFriend")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-teal-600" />
            {t("FriendRequestDialog.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder={t("FriendRequestDialog.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="max-h-80 overflow-y-auto">{renderContent()}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
