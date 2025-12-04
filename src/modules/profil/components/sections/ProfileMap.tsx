import { lazy, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFormatProfileEntity } from "../../hooks/useFormatProfileEntity";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import "@/modules/profil/i18n";
import type { ProfileMapSection } from "../../schema";

const ProfileMapWrapper = lazy(() => import("./ProfileMapWrapper"));

interface ProfileMapProps {
  section: ProfileMapSection;
}

export default function ProfileMap({ section }: ProfileMapProps) {
  const { entity } = useProfileEntity();
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");

  const { geo } = useFormatProfileEntity(entity);

  if (!geo || !geo.latitude || !geo.longitude) {
    return null;
  }

  const lat = parseFloat(String(geo.latitude));
  const lng = parseFloat(String(geo.longitude));

  if (isNaN(lat) || isNaN(lng)) {
    return null;
  }

  const height = section.height || "400px";
  const zoom = section.zoom || 15;
  const showMarker = section.showMarker !== false;

  const LoadingFallback = (
    <div
      className="flex flex-col items-center justify-center gap-2 w-full rounded-lg"
      style={{ height }}
    >
      <Skeleton className="w-full h-full rounded-lg" />
      <p className="text-sm text-muted-foreground">
        {t("ProfileMap.loading")}
      </p>
    </div>
  );

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{t("ProfileMap.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Suspense fallback={LoadingFallback}>
          <ProfileMapWrapper
            lat={lat}
            lng={lng}
            height={height}
            zoom={zoom}
            showMarker={showMarker}
          />
        </Suspense>
      </CardContent>
    </Card>
  );
}
