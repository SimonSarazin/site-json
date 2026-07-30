// Re-export the schema types for use throughout the app
export * from './site-schema';

import { EnhancedNavItemType } from "@/types/site-schema";

export interface HeaderConfig {
  type?: string;
  logo: string;
  nav: EnhancedNavItemType[];
  secondaryNav?: EnhancedNavItemType[];
  navVisibleOnlyForListedPages?: boolean;
  secondaryNavVisibleOnlyForListedPages?: boolean;
  sticky: boolean;
  transparent: boolean;
  height: "sm" | "md" | "lg";
  utilities: {
    themeSwitch: boolean;
    langSwitch: boolean;
    search: boolean;
    auth: boolean;
    cart: boolean;
    notifications: boolean;
    piggyBank: boolean;
    pledge: boolean;
  };
  logoAlt?: string;
  announcement?: {
    message: string;
    link?: string;
  };
}
