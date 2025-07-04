// src/hooks/useCocolightInit.ts
import { useSuspenseQuery } from "@tanstack/react-query";
import { initApi, InitApiOptions, InitApiResult } from "@/lib/apiClient";

export function useCocolightInit(opts: InitApiOptions = {}) {
  const { data } = useSuspenseQuery<InitApiResult>({
    queryKey: ["cocolight-init"],
    queryFn : () => initApi(opts),
  });
  return data;
}
