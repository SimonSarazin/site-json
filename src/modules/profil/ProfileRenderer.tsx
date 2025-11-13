import { Suspense } from "react";
import { ProfileSectionRenderer } from "./ProfileSectionRenderer";
import { Loader2 } from "lucide-react";
import { useProfileEntity } from "./hooks/useProfileEntity";

export function ProfileRenderer() {
  const { config } = useProfileEntity();

  const layoutClass = {
    "default": "max-w-4xl mx-auto",
    "modern": "max-w-6xl mx-auto",
    "compact": "max-w-3xl mx-auto",
    "full-width": "w-full",
  }[config.layout || "default"];

  return (
    <div className={`profile-container ${layoutClass}`}>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        }
      >
        {config.sections.map((section, index) => (
          <ProfileSectionRenderer
            key={`${section.type}-${index}`}
            section={section}
          />
        ))}
      </Suspense>
    </div>
  );
}
