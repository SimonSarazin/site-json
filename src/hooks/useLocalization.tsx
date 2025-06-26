import { LocalizationContext } from "@/contexts/LocalizationContext";
import { useContext } from "react";

export function useLocalization() {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
}