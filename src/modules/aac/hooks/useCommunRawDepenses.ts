import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { asRecord, type UnknownRecord } from "@/modules/cagnotte/utils/dataTransform";

export const COMMUN_RAW_DEPENSES_QUERY_KEY = "aac-milestone-list-depenses";

export function useCommunRawDepenses(answerId?: string) {
  const { api } = useCocolight();

  return useQuery<UnknownRecord[]>({
    queryKey: [COMMUN_RAW_DEPENSES_QUERY_KEY, answerId],
    enabled: !!api && !!answerId,
    queryFn: async () => {
      const answer = await api!.answer({ id: answerId! });
      const raw = asRecord(asRecord(asRecord(answer.serverData).answers).aapStep1).depense;
      return Array.isArray(raw) ? raw.map(asRecord) : [];
    },
  });
}
