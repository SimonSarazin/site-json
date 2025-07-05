import { useState } from "react";
import SearchCard from "./SearchCard";
import { useCocolight } from "@/hooks/useCocolight";
import CustomDrawer from "@/components/layout/CustomDrawer";
import Preview from "./Preview";
import { useT } from "@/hooks/useT";
import { ListConf } from "../schema";

interface SearchListViewProps {
  results: any[];
  columns?: ListConf["columns"];
  card?: ListConf["card"];
}

export default function SearchListView({ results, columns, card }: SearchListViewProps) {
//   const { results, hasNext, next, count } = data || {};
  const t = useT("modules/search");
  const [openDetailsDrawer, setOpenDetailsDrawer] = useState(false);
  const [dataToProfile, setDataToProfile] = useState(null);
  const { setDataToProfile: setContextDataToProfiles } = useCocolight();


  const handleOpenDetails = (data: any) => {
      const detailsData = data.serverData;
      setDataToProfile(detailsData);
      setContextDataToProfiles(data);
      setOpenDetailsDrawer(true);
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
            card={card} // Pass card config if needed
          />
        );
      }
      )
      }
    </div>
      {
        openDetailsDrawer &&
        <CustomDrawer
          isOpenDrawer={openDetailsDrawer}
          openAndCloseDrawer={() => setOpenDetailsDrawer(false)}
          direction={"right"}
          openPageTitle={t("Aller sur la page")}
          overflowType="overflow-hidden"
          link={`/@${(dataToProfile as any)?.slug}`}
        >
          {dataToProfile && <Preview data={dataToProfile as any} />}
        </CustomDrawer>
      }
      </>
  );
}
