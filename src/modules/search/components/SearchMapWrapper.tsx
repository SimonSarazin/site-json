
import { useClientModule } from "@/hooks/useClientModule";
import { useT } from "@/hooks/useT";

interface SearchMapWrapperProps {
  results: any[];
}

export default function SearchMapWrapper({ results }: SearchMapWrapperProps) {
  const [mounted, MapModule] = useClientModule(() => import("./SearchMap"));
  const t = useT("modules/search");

  if (!mounted || !MapModule) {
    return (
      <div className="flex flex-col items-center justify-center gap-2">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground">
          {t("Chargement de la carte…")}
        </p>
      </div>
    );
  }

  const SearchMap = MapModule.default;
  return <SearchMap results={results} />;
}