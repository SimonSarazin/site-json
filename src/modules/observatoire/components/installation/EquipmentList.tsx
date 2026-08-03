import type { SearchEntity } from "@communecter/cocolight-api-client";
import { Dumbbell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/hooks/useT";

interface EquipmentListProps {
  pois: SearchEntity[];
  /** Champ `serverData` du type d'équipement (`conf.typeKey`). */
  typeKey: string;
  loading: boolean;
}

/**
 * Liste simple des équipements d'une installation (nom + type), affichée à la
 * place des jauges et du donut quand l'installation n'a AUCUN créneau — sans
 * elle, la fiche annonce « N équipements » en KPI sans jamais les nommer.
 *
 * Non cliquable à dessein : la fiche Installation s'ouvre déjà par-dessus une
 * fiche Équipement, on n'empile pas une 3ᵉ surface.
 */
export function EquipmentList({ pois, typeKey, loading }: EquipmentListProps) {
  const t = useT("modules/observatoire");

  const rows = pois
    .map((poi) => {
      const sd = poi.serverData as Record<string, unknown> | undefined;
      const type = sd?.[typeKey];
      return {
        id: (poi as { id?: string }).id ?? "",
        name: (sd?.name as string | undefined) ?? "—",
        type: typeof type === "string" ? type.trim() : "",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return (
    <Card className="gap-0 rounded-2xl border-border/50 py-5">
      <CardContent className="space-y-4 px-5">
        <h3 className="text-sm font-semibold text-foreground">
          {t("installation.equipmentList.title")}
        </h3>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id} className="flex items-start gap-2 text-sm">
                <Dumbbell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{row.name}</p>
                  {row.type && (
                    <p className="truncate text-xs text-muted-foreground">{row.type}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
