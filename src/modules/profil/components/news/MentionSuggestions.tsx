import { Loader2 } from "lucide-react";
import { useT } from "@/hooks/useT";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useSearchUsers, type SearchedUser } from "../../hooks/useSearchUsers";

interface MentionSuggestionsProps {
  query: string;
  onSelect: (user: SearchedUser) => void;
}

export function MentionSuggestions({ query, onSelect }: MentionSuggestionsProps) {
  const t = useT("modules/profil");
  const { data: users = [], isLoading } = useSearchUsers(query, query.length >= 2);

  console.log(users);

  return (
    <Command className="rounded-lg border shadow-md" shouldFilter={false}>
      <CommandList className="max-h-[300px] overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              {t("mentions.searching")}
            </span>
          </div>
        )}

        {!isLoading && users.length === 0 && (
          <CommandEmpty>
            <p className="text-sm text-muted-foreground">
              {query.length < 2
                ? t("mentions.typeToSearch")
                : t("mentions.noResults")}
            </p>
          </CommandEmpty>
        )}

        {!isLoading && users.length > 0 && (
          <CommandGroup>
            {users.map((user) => (
              <CommandItem
                key={user.id}
                value={user.slug}
                onSelect={() => onSelect(user)}
                className="flex items-center gap-2 px-3 py-2 cursor-pointer"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  {user.profilThumbImageUrl && (
                    <AvatarImage src={user.profilThumbImageUrl} alt={user.name} />
                  )}
                  <AvatarFallback className="bg-linear-to-br from-primary/80 to-primary text-primary-foreground text-xs font-bold">
                    {user.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{user.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    @{user.slug}
                  </div>
                </div>
                {user.type && (
                  <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted">
                    {user.type}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
}
