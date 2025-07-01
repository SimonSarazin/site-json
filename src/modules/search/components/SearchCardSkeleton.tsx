import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SearchCardSkeleton() {
  return (
    <Card className="relative aspect-[4/3] rounded-lg shadow overflow-hidden border">
      <CardContent className="p-0">
        <Skeleton className="w-full h-full" />
      </CardContent>
    </Card>
  );
}
