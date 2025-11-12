import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Share2, Edit } from "lucide-react";
import type { SearchEntity } from "@/modules/search/schema";
import { useEntityProfile } from "../hooks/useEntityProfile";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/components/profile/i18n";

interface ProfileHeaderProps {
  section: {
    type: "profile-header";
    variant?: "hero" | "simple" | "cover" | "minimal";
    showBackButton?: boolean;
    showShareButton?: boolean;
    showEditButton?: boolean;
  };
  entity: SearchEntity;
}

export default function ProfileHeader({ section, entity }: ProfileHeaderProps) {
  useLoadNamespace("components/profile");
    const t = useT("components/profile");
  const navigate = useNavigate();
  const variant = section.variant || "hero";
  const { imageUrl, name: entityName, shortDescription } = useEntityProfile(entity);

  if (variant === "hero") {
    return (
      <div className="relative w-full">
        {imageUrl && (
          <div className="relative h-64 md:h-96 w-full overflow-hidden">
            <img
              src={imageUrl}
              alt={entityName}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 from-black/60 to-transparent" />
          </div>
        )}

        <div className="absolute top-4 left-4 right-4 flex justify-between">
          {section.showBackButton !== false && (
            <Button
              onClick={() => navigate(-1)}
              variant="secondary"
              size="sm"
              className="backdrop-blur-sm bg-white/90"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("ProfileHeader.back")}
            </Button>
          )}

          <div className="flex gap-2">
            {section.showShareButton && (
              <Button
                variant="secondary"
                size="sm"
                className="backdrop-blur-sm bg-white/90"
                onClick={() => {
                  navigator.share?.({
                    title: entityName,
                    url: window.location.href,
                  });
                }}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            )}

            {section.showEditButton && (
              <Button
                variant="secondary"
                size="sm"
                className="backdrop-blur-sm bg-white/90"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className={`${imageUrl ? "absolute bottom-0 left-0 right-0" : ""} p-6 md:p-8`}>
          <h1 className={`text-3xl md:text-4xl font-bold ${imageUrl ? "text-white" : "text-gray-900"}`}>
            {entityName}
          </h1>
          {shortDescription && (
            <p className={`mt-2 text-lg ${imageUrl ? "text-white/90" : "text-gray-600"}`}>
              {shortDescription}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Variant simple
  return (
    <div className="border-b pb-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        {section.showBackButton !== false && (
          <Button onClick={() => navigate(-1)} variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("ProfileHeader.back")}
          </Button>
        )}

        <div className="flex gap-2">
          {section.showShareButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.share?.({
                  title: entityName,
                  url: window.location.href,
                });
              }}
            >
              <Share2 className="mr-2 h-4 w-4" />
              {t("ProfileHeader.share")}
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={entityName}
            className="w-24 h-24 rounded-lg object-cover"
          />
        )}
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">{entityName}</h1>
          {shortDescription && (
            <p className="mt-2 text-gray-600">{shortDescription}</p>
          )}
        </div>
      </div>
    </div>
  );
}