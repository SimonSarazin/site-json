import { useState } from "react";
import { UserPlus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useT } from "@/hooks/useT";
import { useSendFriendRequest } from "../../hooks/useFriendMutations";
import { useCocolight } from "@/hooks/useCocolight";

// Mock data pour la recherche d'utilisateurs
// TODO: Remplacer par une vraie recherche API
const mockUsers = [
  { id: "1", name: "Alice Martin", username: "alice.martin", avatar: null },
  { id: "2", name: "Bob Dupont", username: "bob.dupont", avatar: null },
  { id: "3", name: "Claire Legrand", username: "claire.legrand", avatar: null },
];

export function FriendRequestDialog() {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { me } = useCocolight();
  const t = useT("modules/profil");

  const sendFriendRequestMutation = useSendFriendRequest(me);

  const filteredUsers = mockUsers.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSendRequest = (userId: string) => {
    sendFriendRequestMutation.mutate({ userId }, {
      onSuccess: () => {
        setOpen(false);
        setSearchTerm("");
      }
    });
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

          <div className="max-h-80 overflow-y-auto">
            {searchTerm === "" ? (
              <div className="text-center py-8">
                <Search className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-muted-foreground text-sm">
                  {t("FriendRequestDialog.startTyping")}
                </p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <Search className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-foreground font-medium mb-2">
                  {t("FriendRequestDialog.noUsersFound")}
                </p>
                <p className="text-muted-foreground text-sm">
                  {t("FriendRequestDialog.tryDifferentSearch")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 hover:bg-muted rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar || undefined} />
                        <AvatarFallback>
                          {user.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-medium text-foreground text-sm">
                          {user.name}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          @{user.username}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleSendRequest(user.id)}
                      disabled={sendFriendRequestMutation.isPending}
                      className="bg-teal-600 hover:bg-teal-700"
                    >
                      <UserPlus className="w-3 h-3 mr-1" />
                      {t("FriendRequestDialog.sendRequest")}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}