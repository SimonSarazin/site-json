"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useIsMounted } from "@/hooks/useIsMounted";
import "@/components/layout/i18n";

export default function ToggleButtonTheme() {
  const mounted = useIsMounted();
  const { theme, setTheme } = useTheme();
  useLoadNamespace("components/layout");
  const t = useT("components/layout");

  if (!mounted) {
    return null;
  }

  return (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">{t("Toggle theme")}</span>
              </Button>
  );
}
