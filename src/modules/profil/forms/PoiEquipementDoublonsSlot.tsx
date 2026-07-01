/**
 * Slot custom « doublons » du form POI équipement (métier, hors moteur générique).
 * Rendu DANS le `<Form>` du GenericForm → lit les valeurs via `useFormContext` ; déclenche
 * `usePoiEquipementMatches` (équipements existants à la même adresse) + aperçu DetailsModeDialog.
 */
import { useState } from "react";
import { useFormContext, type FieldValues } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { useT } from "@/hooks/useT";
import { usePoiEquipementMatches } from "../hooks/usePoiEquipementMatches";
import type { PoiEquipementScope } from "./costum/equipements-sportifs/fns";
import DetailsModeDialog from "@/modules/search/components/detailsMode/DetailsModeDialog";
import type { Poi } from "@communecter/cocolight-api-client";

export function PoiEquipementDoublonsSlot({ scope }: { scope: PoiEquipementScope }) {
  const t = useT("modules/profil");
  const { watch } = useFormContext<FieldValues>();
  const postalCode = (watch("postalCode") as string) ?? "";
  const equipTypeName = (watch("equip_type_name") as string) ?? "";
  const streetAddress = (watch("streetAddress") as string) ?? "";

  const { matches, isLoading, isError, isSearched } = usePoiEquipementMatches({ postalCode, equipTypeName, streetAddress, scope });
  const [detailItem, setDetailItem] = useState<Poi | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  if (!(isLoading || isError || matches.length > 0 || isSearched)) return null;

  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
      <div className="text-sm font-medium">
        <span className="font-bold text-primary">{matches.length}</span> {t("AddPoiEquipement.matches.title")}
      </div>
      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />{t("AddPoiEquipement.matches.loading")}
        </div>
      )}
      {isError && <div className="text-xs text-destructive">{t("AddPoiEquipement.matches.error")}</div>}
      {!isLoading && !isError && matches.length === 0 && isSearched && (
        <div className="text-xs text-muted-foreground">{t("AddPoiEquipement.matches.empty")}</div>
      )}
      {matches.map((match, index) => {
        const sd = match.serverData;
        const addr = sd.address as { streetAddress?: string; postalCode?: string; addressLocality?: string } | undefined;
        const addressLine = [addr?.streetAddress, addr?.postalCode, addr?.addressLocality]
          .map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean).join(", ");
        const displayName = sd.name?.trim() ? sd.name : t("AddPoiEquipement.matches.noName");
        return (
          <button key={sd.id || `${displayName}-${index}`} type="button"
            className="w-full rounded-md border border-border/60 bg-background/60 p-3 text-left transition hover:bg-background"
            onClick={() => { setDetailItem(match); setDetailOpen(true); }}>
            <div className="text-sm font-semibold text-foreground">{displayName}</div>
            <div className="text-xs text-muted-foreground">{addressLine || t("AddPoiEquipement.matches.addressUnknown")}</div>
          </button>
        );
      })}

      {detailItem && (
        <DetailsModeDialog openDetails={detailOpen} setOpenDetails={setDetailOpen} item={detailItem} preview={{ type: "poi-amenities" }} />
      )}
    </div>
  );
}
