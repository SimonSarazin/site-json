import { SiteContext } from "@/contexts/SiteContext";
import { useContext } from "react";

export function useSite() {
  const context = useContext(SiteContext);
  if (!context) {
    throw new Error('useSite must be used within a SiteProvider');
  }
  return context;
}