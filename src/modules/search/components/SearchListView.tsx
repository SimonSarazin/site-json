import SearchCard from "./SearchCard";

interface SearchListViewProps {
  results: any[];
  columns?: {
    lg?: number;
    md?: number;
    sm?: number;
  };
}

export default function SearchListView({ results, columns }: SearchListViewProps) {
//   const { results, hasNext, next, count } = data || {};
   
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
            onClick={() => window.location.hash = "#page.type.organizations.id.641c175068d23c7b6d76969c"}
          />
        );
      }
      )
      }
    </div>
  );
}
