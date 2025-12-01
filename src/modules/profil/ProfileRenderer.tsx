import { Suspense } from "react";
import { ProfileSectionRenderer } from "./ProfileSectionRenderer";
import { Loader2 } from "lucide-react";
import { useProfileEntity } from "./hooks/useProfileEntity";

export function ProfileRenderer() {
  const { config } = useProfileEntity();

  return (
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
  );
}
