// src/hooks/useT.ts
import { useTranslation } from "react-i18next";
import { useLocalization } from "@/hooks/useLocalization";
import { LocalizedString } from "@/types/locale-schema";

export function useT(namespace?: string) {
  const { t: tNs } = useTranslation(namespace);
  const { t: tData } = useLocalization();

  return (key: string | LocalizedString, fallback?: string) => {
    if (typeof key === "string") {
      const k = tNs(key, { defaultValue: key });
      return k === key && fallback ? fallback : k;
    }
    return tData(key, fallback);
  };
}
