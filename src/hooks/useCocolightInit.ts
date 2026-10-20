// src/hooks/useCocolightInit.ts
import { useSuspenseQuery } from "@tanstack/react-query";
import { initApi, InitApiOptions, InitApiResult } from "@/lib/apiClient";
import { COCOLIGHT_INIT_QUERY_KEY } from "@/lib/cocolightInitQuery";

export function useCocolightInit(opts: InitApiOptions = {}) {
  const { data } = useSuspenseQuery<InitApiResult>({
    queryKey: COCOLIGHT_INIT_QUERY_KEY,
    queryFn : () => initApi(opts),
  });
  return data;
}
