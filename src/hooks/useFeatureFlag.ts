import { useSite } from "@/contexts/SiteContext";

export function useFeatureFlag(key: string): boolean {
  const { config } = useSite();
  return !!config.features?.find((f) => f.key === key)?.enabled;
}
