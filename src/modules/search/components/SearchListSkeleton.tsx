import SearchCardSkeleton from "./SearchCardSkeleton";

export default function SearchListSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <SearchCardSkeleton key={i} />
      ))}
    </div>
  );
}
