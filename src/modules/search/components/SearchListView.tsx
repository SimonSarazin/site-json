import SearchCard from "./SearchCard";

interface SearchListViewProps {
  results: any[];
}

export default function SearchListView({ results }: SearchListViewProps) {
//   const { results, hasNext, next, count } = data || {};
   
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {results.map((item, i) => {
        const serverDataSafe = item?.serverData;
        return (
          <SearchCard
            id={serverDataSafe.id}
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
