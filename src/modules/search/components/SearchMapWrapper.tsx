
import { useClientModule } from "@/hooks/useClientModule";
import { useT } from "@/hooks/useT";
import { Skeleton } from "@/components/ui/skeleton";

interface SearchMapWrapperProps {
  results: any[];
}

export default function SearchMapWrapper({ results }: SearchMapWrapperProps) {
  const [mounted, MapModule] = useClientModule(() => import("./SearchMap"));
  const t = useT("modules/search");

  if (!mounted || !MapModule) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 w-full h-full">
        <Skeleton className="w-full h-full" />
        <p className="text-sm text-muted-foreground">
          {t("Chargement de la carte…")}
        </p>
      </div>
    );
  }

  const SearchMap = MapModule.default;
  return <SearchMap results={results} />;
}