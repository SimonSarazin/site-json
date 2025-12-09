import { Users } from "lucide-react";
import { useNavigate } from "react-router";
import { useT } from "@/hooks/useT";
import { getBaseUrl } from "@/lib/constant/common";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ParentItem {
  id?: string;
  _id?: { $id?: string };
  name?: string;
  slug?: string;
  type?: string;
  collection?: string;
  profilThumbImageUrl?: string;
}

interface ProfileBannerCarriedByProps {
  parent: Record<string, ParentItem> | undefined;
}

export function ProfileBannerCarriedBy({ parent }: ProfileBannerCarriedByProps) {
  const t = useT("modules/profil");
  const navigate = useNavigate();
  const maxVisibleImages = 6;
  const baseUrl = getBaseUrl();

  const handleNavigateToProfile = (item: ParentItem) => {
    if (item.slug) {
      navigate(`/profil/${item.slug}`);
    }
  };

  if (!parent || typeof parent !== "object" || Object.keys(parent).length === 0) {
    return null;
  }

  const parentKeys = Object.keys(parent).reverse();
  const totalImages = parentKeys.length;

  const getImageUrl = (item: ParentItem) => {
    if (!item.profilThumbImageUrl) return null;
    if (item.profilThumbImageUrl.startsWith("http")) {
      return item.profilThumbImageUrl;
    }
    return `${baseUrl}${item.profilThumbImageUrl}`;
  };

  return (
    <div className="p-2 mt-5 text-white bg-teal-800/75 h-10 top-2 right-2 rounded-lg absolute flex items-center justify-center z-10">
      <div className="text-xs font-normal flex w-full justify-center items-center gap-2">
        <div className="flex items-center gap-1 font-semibold text-white">
          <Users className="w-4 h-4" />
          {String(t("ProfileBannerCarriedBy.carriedBy"))}:
        </div>
        <div className="flex -space-x-2">
          {parentKeys.slice(0, maxVisibleImages).map((key) => {
            const item = parent[key];
            const imageUrl = getImageUrl(item);

            return (
              <TooltipProvider key={key}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="relative cursor-pointer"
                      onClick={() => handleNavigateToProfile(item)}
                    >
                      <div className="rounded-full border border-border bg-muted">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/images/default-avatar.png";
                            }}
                            className="block w-8 h-8 object-cover rounded-full"
                            alt={item.name || ""}
                          />
                        ) : (
                          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-xs font-medium text-foreground">
                            {item.name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-background">{item.name || "Unknown"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
          {totalImages > maxVisibleImages && (
            <div className="relative flex items-center justify-center w-8 h-8 rounded-full border border-border bg-muted text-foreground cursor-pointer text-xs font-medium">
              +{totalImages - maxVisibleImages}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
