import { useState } from "react";
import SearchCard from "./SearchCard";
import { useCocolight } from "@/hooks/useCocolight";
import CustomDrawer from "@/components/layout/CustomDrawer";
import Preview from "./Preview";
import { useT } from "@/hooks/useT";
import { ListConf } from "../schema";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"; // Assurez‑vous que le chemin correspond à votre projet

interface SearchListViewProps {
  results: any[];
  columns?: ListConf["columns"];
  card?: ListConf["card"];
}

export default function SearchListView({
  results,
  columns,
  card,
}: SearchListViewProps) {
  const t = useT("modules/search");
  const [openDetails, setOpenDetails] = useState(false);
  const [dataToProfile, setDataToProfile] = useState<any>(null);
  const { setDataToProfile: setContextDataToProfiles } = useCocolight();

  const handleOpenDetails = (data: any) => {
    const detailsData = data.serverData;
    setDataToProfile(detailsData);
    setContextDataToProfiles(data);
    setOpenDetails(true);
  };

  const gridClasses = [
    "grid",
    "gap-4",
    columns?.sm ? `sm:grid-cols-${columns.sm}` : null,
    columns?.md ? `md:grid-cols-${columns.md}` : null,
    columns?.lg ? `lg:grid-cols-${columns.lg}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className={gridClasses}>
        {results.map((item) => {
          const serverDataSafe = item?.serverData;
          return (
            <SearchCard
              key={serverDataSafe.id}
              name={serverDataSafe.name}
              type={serverDataSafe?.type || null}
              address={`${serverDataSafe?.address?.streetAddress || ""} ${serverDataSafe?.address?.postalCode || ""} ${serverDataSafe?.address?.addressLocality || ""}`}
              description={serverDataSafe.shortDescription}
              tags={serverDataSafe.tags || []}
              image={serverDataSafe?.profilMediumImageUrl}
              onClick={() => handleOpenDetails(item)}
              card={card}
            />
          );
        })}
      </div>

      {/* Affichage conditionnel des détails */}
      {card?.detailsMode === "drawer" ? (
        <CustomDrawer
          isOpenDrawer={openDetails}
          openAndCloseDrawer={() => setOpenDetails(false)}
          direction="right"
          openPageTitle={t("Aller sur la page")}
          overflowType="overflow-hidden"
          link={`/@${dataToProfile?.slug}`}
        >
          {dataToProfile && <Preview data={dataToProfile as any} />}
        </CustomDrawer>
      ) : (
        <Dialog open={openDetails} onOpenChange={setOpenDetails}>
          <DialogContent className="p-4 min-w-[320px] max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {t("Aperçu")}
              </DialogTitle>
              <DialogDescription>
                {t("Aperçu du contenu")}
              </DialogDescription>
            </DialogHeader>
            {dataToProfile && <Preview data={dataToProfile as any} />}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}