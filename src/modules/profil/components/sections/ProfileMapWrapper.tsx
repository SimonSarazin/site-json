import { useClientModule } from "@/hooks/useClientModule";
import { useT } from "@/hooks/useT";
import { Skeleton } from "@/components/ui/skeleton";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";

interface ProfileMapWrapperProps {
  lat: number;
  lng: number;
  height?: string;
  zoom?: number;
  showMarker?: boolean;
}

export default function ProfileMapWrapper(props: ProfileMapWrapperProps) {
  const [mounted, MapModule] = useClientModule(() => import("./ProfileMapLeaflet"));
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");

  if (!mounted || !MapModule) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 w-full rounded-lg"
        style={{ height: props.height || "400px" }}
      >
        <Skeleton className="w-full h-full rounded-lg" />
        <p className="text-sm text-muted-foreground">
          {t("ProfileMap.loading")}
        </p>
      </div>
    );
  }

  const ProfileMapLeaflet = MapModule.default;
  return <ProfileMapLeaflet {...props} />;
}
