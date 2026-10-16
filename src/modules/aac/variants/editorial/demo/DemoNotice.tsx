import { Badge } from "@/components/ui/badge";
import { useT } from "@/hooks/useT";

/** Bandeau « Exemple » en tête de chaque bloc alimenté par `demoContent`. */
export function DemoNotice() {
  const t = useT("modules/aac");
  return (
    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-demo-notice="">
      <Badge variant="outline" className="border-dashed">
        {String(t("editorial.demo.badge"))}
      </Badge>
      {String(t("editorial.demo.notice"))}
    </p>
  );
}
